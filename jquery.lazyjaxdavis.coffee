(($, window, document) -> # encapsulate whole start
  
  ns = {}
  $document = $(document)

  # ============================================================
  # tiny utils

  # setTimeout wrapper

  wait = ns.wait = (time) ->
    $.Deferred (defer) ->
      setTimeout ->
        defer.resolve()
      , time
  
  # detect features

  $.support.pushstate = Davis.supported()

  
  # ============================================================
  # string manipulators

  # "#foobar" -> true
  # "foobar"  -> false

  ns.isToId = (path) ->
    if (path.charAt 0) is '#'
      return true
    else
      return false
    
  # "/somewhere/foo.html#bar" will be parsed to...
  # { path: "/somewhere/foo.html", hash: "#bar" }

  ns.tryParseAnotherPageAnchor = (path) ->
    if ns.isToId(path)
      return false
    if (path.indexOf '#') is -1
      return false
    res = path.match /^([^#]+)#(.+)/
    ret = { path: res[1] }
    if res[2] then ret.hash = "##{res[2]}"
    ret

  # filters html string
  # "<title>foobar</title>", /<title[^>]*>([^<]*)<\/title>/
  # -> "foobar"

  ns.filterStr = (str, expr) ->
    res = str.match expr
    if res and res[1]
      return $.trim res[1]
    else
      return null


  # ============================================================
  # ajax callers

  ns.fetchPage = (->
    current = null
    (url, options) ->
      ret = $.Deferred (defer) ->
        if current then current.abort()
        options = $.extend
          url: url
        , options
        current = ($.ajax options).then (res) ->
          current = null
          defer.resolve res
        , (xhr, msg) ->
          aborted = (msg is 'abort')
          defer.reject aborted
      .promise()
      ret.abort = -> current?.abort()
      ret
  )()


  # ============================================================
  # event module

  class ns.Event
    constructor: ->
      @_callbacks = {}

    bind: (ev, callback) ->
      evs = ev.split(' ')
      for name in evs
        @_callbacks[name] or= []
        @_callbacks[name].push(callback)
      @

    one: (ev, callback) ->
      @bind ev, ->
        @unbind(ev, arguments.callee)
        callback.apply(@, arguments)

    trigger: (args...) ->
      ev = args.shift()
      list = @_callbacks?[ev]
      return unless list
      for callback in list
        if callback.apply(@, args) is false
          break
      @

    unbind: (ev, callback) ->
      unless ev
        @_callbacks = {}
        return @

      list = @_callbacks?[ev]
      return this unless list

      unless callback
        delete @_callbacks[ev]
        return this

      for cb, i in list when cb is callback
        list = list.slice()
        list.splice(i, 1)
        @_callbacks[ev] = list
        break
      @


  # ============================================================
  # main
  
  class ns.HistoryLogger
    constructor: ->
      @_items = []
    push: (obj) ->
      @_items.push obj
      @
    last: ->
      l = @_items.length
      return if l then @_items[l-1] else null
    isToSamePageRequst: (path) ->
      last = @last()
      if not last then return false
      if path is last
        return true
      else
        return false
    size: ->
      @_items.length

  
  class ns.Page extends ns.Event

    eventNames = [
      'fetchstart'
      'fetchsuccess'
      'fetchabort'
      'fetchfail'
      'pageready'
      'anchorhandler'
    ]

    options:
      ajxoptions:
        dataType: 'text'
        cache: true
      expr: null
      updatetitle: true
      title: null

    router: null
    config: null
    _text: null

    constructor: (@request, config, @routed, @router, options, @hash) ->

      super

      @config = $.extend {}, @config, config
      @options = $.extend true, {}, @options, options
      @path = @config.path or @request.path

      $.each eventNames, (i, eventName) =>
        $.each @config, (key, val) =>
          if eventName isnt key then return true
          @bind eventName, val

      anchorhandler = @config?.anchorhandler or @options?.anchorhandler
      if anchorhandler then @_anchorhandler = anchorhandler
      @bind 'pageready', =>
        if not @hash then return
        @_anchorhandler.call @, @hash

    _anchorhandler: (hash) ->
      if not hash then return @
      top = ($document.find hash).offset().top
      window.scrollTo 0, top
      @

    fetch: ->
      currentFetch = null
      path = @request.path
      ajaxoptions = @options.ajaxoptions
      @_fetchDefer = $.Deferred (defer) =>
        @trigger 'fetchstart', @
        currentFetch = (ns.fetchPage path, ajaxoptions).then (text) =>
          @_text = text
          @trigger 'fetchsuccess', @
          defer.resolve()
          @updatetitle()
        , (aborted) =>
          if aborted
            @trigger 'fetchabort', @
          else
            @trigger 'fetchfail', @
          defer.reject
            aborted: aborted
        .always =>
          @_fetchDefer = null
      @_fetchDefer.abort = -> currentFetch.abort()
      @_fetchDefer
    
    abort: ->
      @_fetchDefer?.abort()
      @

    rip: (exprKey) ->
      if not @_text then return null
      if not exprKey then return @_text
      expr = @options?.expr?[exprKey]
      if not expr then return null
      ns.filterStr @_text, expr

    updatetitle: ->
      if not @options.updatetitle then return @
      title = null
      if not title and @_text
        title = @rip('title')
      if not title then return @
      document.title = title
      @


  class ns.Router extends ns.Event

    eventNames = [
      'everyfetchstart'
      'everyfetchsuccess'
      'everyfetchfail'
      'everypageready'
    ]

    options:
      ajaxoptions: null
      expr:
        title: /<title[^>]*>([^<]*)<\/title>/
        content: /<!-- LazyJaxDavis start -->([\s\S]*)<!-- LazyJaxDavis end -->/
      davis:
        linkSelector: 'a:not(.apply-nolazy)'
        formSelector: 'form:not(.apply-nolazy)'
        throwErrors: false
        handleRouteNotFound: true
      minwaittime: 0
      updatetitle: true
      firereadyonstart: true

    constructor: (options, pages, extraRoute) ->

      # handle instance creation wo new
      if not (@ instanceof arguments.callee)
        return new ns.Router options, pages, extraRoute

      super

      @pages = pages
      @extraRoute = extraRoute
      @options = $.extend true, {}, @options, options
      @logger = new ns.HistoryLogger
      @_eventify()
      @_setupDavis()
      if @options.firereadyonstart then @fireready()

    _eventify: ->
      $.each eventNames, (i, eventName) =>
        $.each @options, (key, val) =>
          if key isnt eventName then return true
          @bind eventName, val
      @

    _createPage: (request, config, routed, hash) ->

      options =
        expr: @options.expr
        updatetitle: @options.updatetitle

      if @options.anchorhandler
        options.anchorhandler = @options.anchorhandler

      if @options.ajaxoptions
        if config.ajaxoptions
          options.ajaxoptions = config.ajaxoptions
        else
          options.ajaxoptions = @options.ajaxoptions

      if not hash and request?.path
        res = ns.tryParseAnotherPageAnchor request.path
        hash = res.hash or null

      new ns.Page request, config, routed, @, options, hash

    _setupDavis: ->

      if not $.support.pushstate then return
      self = @ # Davis needs "this" scope

      completePage = (page) ->
        page.bind 'pageready', ->
          self.trigger 'everypageready'
        self.logger.push page
        self.fetch page

      @davis = new Davis ->
        davis = @
        if not self.pages then return
        $.each self.pages, (i, pageConfig) ->
          davis.get pageConfig.path, (request) ->
            if self.logger.isToSamePageRequst request.path then return
            page = self._createPage request, pageConfig, true
            completePage page
          true
        self.extraRoute?.call davis

      if @options.davis.handleRouteNotFound
        @davis.bind 'routeNotFound', (request) ->

          # if it was just an anchor to the same page, ignore
          if ns.isToId request.path
            self.trigger 'toid', request.path
            return

          # check whether the request was another page with anchor.
          # If was anchored, there may be config in @pages
          res = ns.tryParseAnotherPageAnchor request.path
          hash = res.hash or null
          path = res.path

          if self.logger.isToSamePageRequst path then return

          config = (self._findPageWhosePathIs path) or null
          routed = if config then true else false
          page = self._createPage request, config, routed, hash
          completePage page

      @davis.configure (config) =>
        $.each @options.davis, (key, val) ->
          config[key] = val
          true

      @bind 'toid', (hash) =>
        if @options.toid
          @options.toid.call @, request.path
        else
          location.href = hash

      @_tweakDavis()
      @

    _findPageWhosePathIs: (path) ->
      ret = null
      $.each @pages, (i, config) ->
        if config.path is path
          ret = config
          return false
        else
          return true
      ret

    _tweakDavis: ->
      warn = @davis.logger.warn
      info = @davis.logger.info
      @davis.logger.warn = (args...) =>
        if (args[0].indexOf 'routeNotFound') isnt -1
          args[0] = args[0].replace /routeNotFound/, 'unRouted'
          info.apply @davis.logger, args
        else
          warn.apply @davis.logger, args
      @

    fetch: (page) ->
      $.Deferred (defer) =>
        @trigger 'everyfetchstart', page
        ($.when page.fetch(), (wait @options.minwaittime)).then =>
          @trigger 'everyfetchsuccess', page
          defer.resolve()
        , =>
          @trigger 'everyfetchfail', page
      .promise()

    stop: ->
      @davis?.stop()
      @

    navigate: (path, method) ->
      if @davis
        request = new Davis.Request
          method: method or 'get'
          fullPath: path
          title: ''
        Davis.location.assign request
      else
        location.href = path
      @

    fireready: ->
      if @pages?.length
        $.each @pages, (i, pageConfig) =>
          handleThis = false
          if pageConfig.pathexpr
            handleThis = pageConfig.pathexpr.test location.pathname
          else
            handleThis = pageConfig.path is location.pathname
          if not handleThis then return true
          pageConfig?.pageready()
          return false
      @trigger 'everypageready'
      @


  # ============================================================
  
  # globalify

  $.LazyJaxDavisNs = ns
  $.LazyJaxDavis = ns.Router


) jQuery, @, @document # encapsulate whole end
