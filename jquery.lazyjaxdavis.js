/*! jQuery.LazyJaxDavis - v0.0.0 -  4/1/2012
 * https://github.com/Takazudo/jQuery.LazyJaxDavix
 * Copyright (c) 2012 "Takazudo" Takeshi Takatsudo; Licensed MIT */

var __slice = Array.prototype.slice,
  __hasProp = Object.prototype.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

(function($, window, document) {
  var $document, ns, wait;
  ns = {};
  $document = $(document);
  wait = ns.wait = function(time) {
    return $.Deferred(function(defer) {
      return setTimeout(function() {
        return defer.resolve();
      }, time);
    });
  };
  $.support.pushstate = Davis.supported();
  ns.isToId = function(path) {
    if ((path.charAt(0)) === '#') {
      return true;
    } else {
      return false;
    }
  };
  ns.tryParseAnotherPageAnchor = function(path) {
    var res, ret;
    if (ns.isToId(path)) return false;
    if ((path.indexOf('#')) === -1) return false;
    res = path.match(/^([^#]+)#(.+)/);
    ret = {
      path: res[1]
    };
    if (res[2]) ret.hash = "#" + res[2];
    return ret;
  };
  ns.filterStr = function(str, expr) {
    var res;
    res = str.match(expr);
    if (res && res[1]) {
      return $.trim(res[1]);
    } else {
      return null;
    }
  };
  ns.fetchPage = (function() {
    var current;
    current = null;
    return function(url, options) {
      var ret;
      ret = $.Deferred(function(defer) {
        if (current) current.abort();
        options = $.extend({
          url: url
        }, options);
        return current = ($.ajax(options)).then(function(res) {
          current = null;
          return defer.resolve(res);
        }, function(xhr, msg) {
          var aborted;
          aborted = msg === 'abort';
          return defer.reject(aborted);
        });
      }).promise();
      ret.abort = function() {
        return current != null ? current.abort() : void 0;
      };
      return ret;
    };
  })();
  ns.Event = (function() {

    function Event() {
      this._callbacks = {};
    }

    Event.prototype.bind = function(ev, callback) {
      var evs, name, _base, _i, _len;
      evs = ev.split(' ');
      for (_i = 0, _len = evs.length; _i < _len; _i++) {
        name = evs[_i];
        (_base = this._callbacks)[name] || (_base[name] = []);
        this._callbacks[name].push(callback);
      }
      return this;
    };

    Event.prototype.one = function(ev, callback) {
      return this.bind(ev, function() {
        this.unbind(ev, arguments.callee);
        return callback.apply(this, arguments);
      });
    };

    Event.prototype.trigger = function() {
      var args, callback, ev, list, _i, _len, _ref;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      ev = args.shift();
      list = (_ref = this._callbacks) != null ? _ref[ev] : void 0;
      if (!list) return;
      for (_i = 0, _len = list.length; _i < _len; _i++) {
        callback = list[_i];
        if (callback.apply(this, args) === false) break;
      }
      return this;
    };

    Event.prototype.unbind = function(ev, callback) {
      var cb, i, list, _len, _ref;
      if (!ev) {
        this._callbacks = {};
        return this;
      }
      list = (_ref = this._callbacks) != null ? _ref[ev] : void 0;
      if (!list) return this;
      if (!callback) {
        delete this._callbacks[ev];
        return this;
      }
      for (i = 0, _len = list.length; i < _len; i++) {
        cb = list[i];
        if (!(cb === callback)) continue;
        list = list.slice();
        list.splice(i, 1);
        this._callbacks[ev] = list;
        break;
      }
      return this;
    };

    return Event;

  })();
  ns.HistoryLogger = (function() {

    function HistoryLogger() {
      this._items = [];
    }

    HistoryLogger.prototype.push = function(obj) {
      this._items.push(obj);
      return this;
    };

    HistoryLogger.prototype.last = function() {
      var l;
      l = this._items.length;
      if (l) {
        return this._items[l - 1];
      } else {
        return null;
      }
    };

    HistoryLogger.prototype.isToSamePageRequst = function(path) {
      var last;
      last = this.last();
      if (!last) return false;
      if (path === last) {
        return true;
      } else {
        return false;
      }
    };

    HistoryLogger.prototype.size = function() {
      return this._items.length;
    };

    return HistoryLogger;

  })();
  ns.Page = (function(_super) {
    var eventNames;

    __extends(Page, _super);

    eventNames = ['fetchstart', 'fetchsuccess', 'fetchabort', 'fetchfail', 'pageready', 'anchorhandler'];

    Page.prototype.options = {
      ajxoptions: {
        dataType: 'text',
        cache: true
      },
      expr: null,
      updatetitle: true,
      title: null
    };

    Page.prototype.router = null;

    Page.prototype.config = null;

    Page.prototype._text = null;

    function Page(request, config, routed, router, options, hash) {
      var anchorhandler, _ref, _ref2,
        _this = this;
      this.request = request;
      this.routed = routed;
      this.router = router;
      this.hash = hash;
      Page.__super__.constructor.apply(this, arguments);
      this.config = $.extend({}, this.config, config);
      this.options = $.extend(true, {}, this.options, options);
      this.path = this.config.path || this.request.path;
      $.each(eventNames, function(i, eventName) {
        return $.each(_this.config, function(key, val) {
          if (eventName !== key) return true;
          return _this.bind(eventName, val);
        });
      });
      anchorhandler = ((_ref = this.config) != null ? _ref.anchorhandler : void 0) || ((_ref2 = this.options) != null ? _ref2.anchorhandler : void 0);
      if (anchorhandler) this._anchorhandler = anchorhandler;
      this.bind('pageready', function() {
        if (!_this.hash) return;
        return _this._anchorhandler.call(_this, _this.hash);
      });
    }

    Page.prototype._anchorhandler = function(hash) {
      var top;
      if (!hash) return this;
      top = ($document.find(hash)).offset().top;
      window.scrollTo(0, top);
      return this;
    };

    Page.prototype.fetch = function() {
      var ajaxoptions, currentFetch, path,
        _this = this;
      currentFetch = null;
      path = this.request.path;
      ajaxoptions = this.options.ajaxoptions;
      this._fetchDefer = $.Deferred(function(defer) {
        _this.trigger('fetchstart', _this);
        return currentFetch = (ns.fetchPage(path, ajaxoptions)).then(function(text) {
          _this._text = text;
          _this.trigger('fetchsuccess', _this);
          defer.resolve();
          return _this.updatetitle();
        }, function(aborted) {
          if (aborted) {
            _this.trigger('fetchabort', _this);
          } else {
            _this.trigger('fetchfail', _this);
          }
          return defer.reject({
            aborted: aborted
          });
        }).always(function() {
          return _this._fetchDefer = null;
        });
      });
      this._fetchDefer.abort = function() {
        return currentFetch.abort();
      };
      return this._fetchDefer;
    };

    Page.prototype.abort = function() {
      var _ref;
      if ((_ref = this._fetchDefer) != null) _ref.abort();
      return this;
    };

    Page.prototype.rip = function(exprKey) {
      var expr, _ref, _ref2;
      if (!this._text) return null;
      if (!exprKey) return this._text;
      expr = (_ref = this.options) != null ? (_ref2 = _ref.expr) != null ? _ref2[exprKey] : void 0 : void 0;
      if (!expr) return null;
      return ns.filterStr(this._text, expr);
    };

    Page.prototype.updatetitle = function() {
      var title;
      if (!this.options.updatetitle) return this;
      title = null;
      if (!title && this._text) title = this.rip('title');
      if (!title) return this;
      document.title = title;
      return this;
    };

    return Page;

  })(ns.Event);
  ns.Router = (function(_super) {
    var eventNames;

    __extends(Router, _super);

    eventNames = ['everyfetchstart', 'everyfetchsuccess', 'everyfetchfail', 'everypageready'];

    Router.prototype.options = {
      ajaxoptions: null,
      expr: {
        title: /<title[^>]*>([^<]*)<\/title>/,
        content: /<!-- LazyJaxDavis start -->([\s\S]*)<!-- LazyJaxDavis end -->/
      },
      davis: {
        linkSelector: 'a:not(.apply-nolazy)',
        formSelector: 'form:not(.apply-nolazy)',
        throwErrors: false,
        handleRouteNotFound: true
      },
      minwaittime: 0,
      updatetitle: true,
      firereadyonstart: true
    };

    function Router(options, pages, extraRoute) {
      if (!(this instanceof arguments.callee)) {
        return new ns.Router(options, pages, extraRoute);
      }
      Router.__super__.constructor.apply(this, arguments);
      this.pages = pages;
      this.extraRoute = extraRoute;
      this.options = $.extend(true, {}, this.options, options);
      this.logger = new ns.HistoryLogger;
      this._eventify();
      this._setupDavis();
      if (this.options.firereadyonstart) this.fireready();
    }

    Router.prototype._eventify = function() {
      var _this = this;
      $.each(eventNames, function(i, eventName) {
        return $.each(_this.options, function(key, val) {
          if (key !== eventName) return true;
          return _this.bind(eventName, val);
        });
      });
      return this;
    };

    Router.prototype._createPage = function(request, config, routed, hash) {
      var options, res;
      options = {
        expr: this.options.expr,
        updatetitle: this.options.updatetitle
      };
      if (this.options.anchorhandler) {
        options.anchorhandler = this.options.anchorhandler;
      }
      if (this.options.ajaxoptions) {
        if (config.ajaxoptions) {
          options.ajaxoptions = config.ajaxoptions;
        } else {
          options.ajaxoptions = this.options.ajaxoptions;
        }
      }
      if (!hash && (request != null ? request.path : void 0)) {
        res = ns.tryParseAnotherPageAnchor(request.path);
        hash = res.hash || null;
      }
      return new ns.Page(request, config, routed, this, options, hash);
    };

    Router.prototype._setupDavis = function() {
      var completePage, self,
        _this = this;
      if (!$.support.pushstate) return;
      self = this;
      completePage = function(page) {
        page.bind('pageready', function() {
          return self.trigger('everypageready');
        });
        self.logger.push(page);
        return self.fetch(page);
      };
      this.davis = new Davis(function() {
        var davis, _ref;
        davis = this;
        if (!self.pages) return;
        $.each(self.pages, function(i, pageConfig) {
          davis.get(pageConfig.path, function(request) {
            var page;
            if (self.logger.isToSamePageRequst(request.path)) return;
            page = self._createPage(request, pageConfig, true);
            return completePage(page);
          });
          return true;
        });
        return (_ref = self.extraRoute) != null ? _ref.call(davis) : void 0;
      });
      if (this.options.davis.handleRouteNotFound) {
        this.davis.bind('routeNotFound', function(request) {
          var config, hash, page, path, res, routed;
          if (ns.isToId(request.path)) {
            self.trigger('toid', request.path);
            return;
          }
          res = ns.tryParseAnotherPageAnchor(request.path);
          hash = res.hash || null;
          path = res.path;
          if (self.logger.isToSamePageRequst(path)) return;
          config = (self._findPageWhosePathIs(path)) || null;
          routed = config ? true : false;
          page = self._createPage(request, config, routed, hash);
          return completePage(page);
        });
      }
      this.davis.configure(function(config) {
        return $.each(_this.options.davis, function(key, val) {
          config[key] = val;
          return true;
        });
      });
      this.bind('toid', function(hash) {
        if (_this.options.toid) {
          return _this.options.toid.call(_this, request.path);
        } else {
          return location.href = hash;
        }
      });
      this._tweakDavis();
      return this;
    };

    Router.prototype._findPageWhosePathIs = function(path) {
      var ret;
      ret = null;
      $.each(this.pages, function(i, config) {
        if (config.path === path) {
          ret = config;
          return false;
        } else {
          return true;
        }
      });
      return ret;
    };

    Router.prototype._tweakDavis = function() {
      var info, warn,
        _this = this;
      warn = this.davis.logger.warn;
      info = this.davis.logger.info;
      this.davis.logger.warn = function() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        if ((args[0].indexOf('routeNotFound')) !== -1) {
          args[0] = args[0].replace(/routeNotFound/, 'unRouted');
          return info.apply(_this.davis.logger, args);
        } else {
          return warn.apply(_this.davis.logger, args);
        }
      };
      return this;
    };

    Router.prototype.fetch = function(page) {
      var _this = this;
      return $.Deferred(function(defer) {
        _this.trigger('everyfetchstart', page);
        return ($.when(page.fetch(), wait(_this.options.minwaittime))).then(function() {
          _this.trigger('everyfetchsuccess', page);
          return defer.resolve();
        }, function() {
          return _this.trigger('everyfetchfail', page);
        });
      }).promise();
    };

    Router.prototype.stop = function() {
      var _ref;
      if ((_ref = this.davis) != null) _ref.stop();
      return this;
    };

    Router.prototype.navigate = function(path, method) {
      var request;
      if (this.davis) {
        request = new Davis.Request({
          method: method || 'get',
          fullPath: path,
          title: ''
        });
        Davis.location.assign(request);
      } else {
        location.href = path;
      }
      return this;
    };

    Router.prototype.fireready = function() {
      var _ref,
        _this = this;
      if ((_ref = this.pages) != null ? _ref.length : void 0) {
        $.each(this.pages, function(i, pageConfig) {
          var handleThis;
          handleThis = false;
          if (pageConfig.pathexpr) {
            handleThis = pageConfig.pathexpr.test(location.pathname);
          } else {
            handleThis = pageConfig.path === location.pathname;
          }
          if (!handleThis) return true;
          if (pageConfig != null) pageConfig.pageready();
          return false;
        });
      }
      this.trigger('everypageready');
      return this;
    };

    return Router;

  })(ns.Event);
  $.LazyJaxDavisNs = ns;
  return $.LazyJaxDavis = ns.Router;
})(jQuery, this, this.document);
