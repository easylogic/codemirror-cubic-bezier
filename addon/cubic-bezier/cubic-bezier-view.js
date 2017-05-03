(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
        mod(require("codemirror"));
    else if (typeof define == "function" && define.amd) // AMD
        define(["codemirror"], mod);
    else // Plain browser env
        mod(CodeMirror);
})(function(CodeMirror) {
    "use strict";

    var cubicbezier_class = 'codemirror-bezierview';
    var bezier_regexp = /(ease\-in\-out|ease\-in|ease\-out|linear|ease|cubic-bezier\(\s*(\S+)\s*,\s*(\S+)\s*,\s*(\S+)\s*,\s*(\S+)\s*\))/gi;


    CodeMirror.defineOption("cubicbezier", false, function (cm, val, old) {
        if (old && old != CodeMirror.Init) {

            if (cm.state.cubicbezier)
            {
                cm.state.cubicbezier.destroy();
                cm.state.cubicbezier = null;

            }
            // remove event listener
        }

        if (val)
        {
            cm.state.cubicbezier = new codemirror_cubicbezier(cm, val);
        }
    });

    function onChange(cm, evt) {
        if (evt.origin == 'setValue') {  // if content is changed by setValue method, it initialize markers
            cm.state.cubicbezier.close_bezier_picker();
            cm.state.cubicbezier.init_bezier_update();
            cm.state.cubicbezier.style_bezier_update();
        } else {
            cm.state.cubicbezier.style_bezier_update(cm.getCursor().line);
        }

    }

    function onUpdate(cm, evt) {
        if (!cm.state.cubicbezier.isUpdate) {
            cm.state.cubicbezier.isUpdate = true;
            cm.state.cubicbezier.close_bezier_picker();
            cm.state.cubicbezier.init_bezier_update();
            cm.state.cubicbezier.style_bezier_update();
        }
    }


    function onRefresh(cm, evt) {
        onChange(cm, { origin : 'setValue'});
    }

    function onKeyup(cm) {
        cm.state.cubicbezier.keyup();
    }

    function onMousedown(cm, evt) {
        if (cm.state.cubicbezier.is_edit_mode())
        {
            cm.state.cubicbezier.check_mousedown(evt);
        }
    }

    function onPaste (cm, evt) {
        onChange(cm, { origin : 'setValue'});
    }

    function onScroll (cm) {
        cm.state.cubicbezier.close_bezier_picker();
    }

    function debounce (callback, delay) {

        var t = undefined;

        return function (cm, e) {
            if (t) {
                clearTimeout(t);
            }

            t = setTimeout(function () {
                callback(cm, e);
            }, delay || 300);
        }
    }

    function has_class(el, cls) {
        if (!el.className)
        {
            return false;
        } else {
            var newClass = ' ' + el.className + ' ';
            return newClass.indexOf(' ' + cls + ' ') > -1;
        }
    }

    function codemirror_cubicbezier (cm, opt) {
        var self = this;

        if (typeof opt == 'boolean')
        {
            opt = { mode : 'view' };
        } else {
            opt = Object.assign({ mode: 'view' }, opt || {});
        }

        this.opt = opt;
        this.cm = cm;
        this.markers = {};

        if (this.cm.cubicbezier) {
            this.cubicbezier = this.cm.cubicbezier();
        } else if (this.opt.cubicbezier) {
            this.cubicbezier = this.opt.cubicbezier;
        }

        this.init_event();

    }

    codemirror_cubicbezier.prototype.init_event = function () {

        this.cm.on('mousedown', onMousedown);
        this.cm.on('keyup', onKeyup);
        this.cm.on('change', onChange);
        this.cm.on('update', onUpdate);
        this.cm.on('refresh', onRefresh);

        // create paste callback
        this.onPasteCallback = (function (cm, callback) {
            return  function (evt) {
                callback.call(this, cm, evt);
            }
        })(this.cm, onPaste);

        this.cm.getWrapperElement().addEventListener('paste', this.onPasteCallback);

        if (this.is_edit_mode())
        {
            this.onScrollCallback = debounce(onScroll, 50);
            this.cm.on('scroll', this.onScrollCallback);
        }

    }

    codemirror_cubicbezier.prototype.is_edit_mode = function () {
        return this.opt.mode == 'edit';
    }

    codemirror_cubicbezier.prototype.is_view_mode = function () {
        return this.opt.mode == 'view';
    }

    codemirror_cubicbezier.prototype.destroy = function () {
        this.cm.off('mousedown', onMousedown);
        this.cm.off('keyup', onKeyup);
        this.cm.off('change', onChange);
        this.cm.off('update', onUpdate);
        this.cm.off('refresh', onRefresh);
        this.cm.getWrapperElement().removeEventListener('paste', this.onPasteCallback);

        if (this.is_edit_mode())
        {
            this.cm.on('scroll', this.onScrollCallback);
        }
    }

    codemirror_cubicbezier.prototype.hasClass = function (el, className) {
        if (!el.className)
        {
            return false;
        } else {
            var newClass = ' ' + el.className + ' ';
            return newClass.indexOf(' ' + className + ' ') > -1;
        }
    }

    codemirror_cubicbezier.prototype.check_mousedown = function (evt) {
        if (this.hasClass(evt.target, cubicbezier_class) )
        {
            this.open_bezier_picker(evt.target);
        } else {
            this.close_bezier_picker();
        }
    }

    codemirror_cubicbezier.prototype.popup_bezier_picker = function () {
        var cursor = this.cm.getCursor();
        var self = this;
        var bezierMarker = {
            lineNo : cursor.line,
            ch : cursor.ch,
            isShortCut : true
        };

        Object.keys(this.markers).forEach(function(key) {
            var searchKey = "#" + key;
            if (searchKey.indexOf( "#" + bezierMarker.lineNo + ":") > -1) {
                var marker = self.markers[key];

                if (marker.ch <= bezierMarker.ch && bezierMarker.ch <= marker.ch + marker.color.length) {
                    // when cursor has marker
                    bezierMarker.ch = marker.ch;
                    bezierMarker.bezier = marker.bezier;
                }

            }
        });

        this.open_bezier_picker(bezierMarker);
    }

    codemirror_cubicbezier.prototype.open_bezier_picker = function (el) {
        var lineNo = el.lineNo;
        var ch = el.ch;
        var bezier = el.bezier;


        if (this.cubicbezier) {
            var self = this;
            var prevbezier = bezier;
            var pos = this.cm.charCoords({line : lineNo, ch : ch });
            this.cubicbezier.show({
                left : pos.left,
                top : pos.bottom,
                isShortCut : el.isShortCut || false,
                hideDelay : self.opt.hideDelay || 2000
            }, bezier, function (newbezier) {
                self.cm.replaceRange(newbezier, { line : lineNo, ch : ch } , { line : lineNo, ch : ch + prevbezier.length }, '*cubicbezier');
                prevbezier = newbezier;
            }, function /* hide callback */() {
                self.cm.focus();
            });

        }

    }

    codemirror_cubicbezier.prototype.close_bezier_picker = function (el) {
        if (this.cubicbezier)
        {
            this.cubicbezier.hide();
        }
    }

    codemirror_cubicbezier.prototype.key = function (lineNo, ch) {
        return [lineNo, ch].join(":");
    }


    codemirror_cubicbezier.prototype.keyup = function (evt) {

        if (this.cubicbezier) {
            if (evt.key == 'Escape') {
                this.cubicbezier.hide();
            } else if (this.cubicbezier.isShortCut() == false) {
                this.cubicbezier.hide();
            }
        }
    }

    codemirror_cubicbezier.prototype.init_bezier_update = function () {
        this.markers = {};  // initialize marker list
    }

    codemirror_cubicbezier.prototype.style_bezier_update = function (lineHandle) {

        if (lineHandle) {
            this.match(lineHandle);
        } else {
            var max = this.cm.lineCount();

            for(var lineNo = 0; lineNo < max; lineNo++) {
                this.match(lineNo);
            }
        }

    }

    codemirror_cubicbezier.prototype.empty_marker = function (lineNo, lineHandle) {
        var list = lineHandle.markedSpans || [];

        for(var i = 0, len = list.length; i < len; i++) {
            var key = this.key(lineNo, list[i].from);


            if (key && has_class(list[i].marker.replacedWith, cubicbezier_class)) {
                delete this.markers[key];
                list[i].marker.clear();
            }

        }
    }


    codemirror_cubicbezier.prototype.match_result = function (lineHandle) {
        return lineHandle.text.match(bezier_regexp);
    }

    codemirror_cubicbezier.prototype.match = function (lineNo) {
        var lineHandle = this.cm.getLineHandle(lineNo);

        this.empty_marker(lineNo, lineHandle);

        var result = this.match_result(lineHandle);
        if (result)
        {
            var obj = { next : 0 };
            for(var i = 0, len = result.length; i < len; i++) {
                this.render(obj, lineNo, lineHandle, result[i]);
            }
        }
    }

    codemirror_cubicbezier.prototype.make_element = function () {
        var el = document.createElement('div');

        el.className = cubicbezier_class;

        if (this.is_edit_mode())
        {
            el.title ="open bezier picker";
        } else {
            el.title ="";
        }

        return el;
    }


    codemirror_cubicbezier.prototype.set_state = function (lineNo, start, bezier) {
        var marker = this.create_marker(lineNo, start);


        marker.lineNo = lineNo;
        marker.ch = start;
        marker.bezier = bezier;

        return marker;
    }

    codemirror_cubicbezier.prototype.create_marker = function (lineNo, start) {

        var key = this.key(lineNo,start);

        if (!this.markers[key]) {
            this.markers[key] = this.make_element();
        }


        return this.markers[key];

    }

    codemirror_cubicbezier.prototype.has_marker = function (lineNo, start) {
        var key = this.key(lineNo,start);
        return !!(this.markers[key])
    }

    codemirror_cubicbezier.prototype.update_element = function (el, bezier) {
        //el.style.backgroundbezier = bezier;
    }

    codemirror_cubicbezier.prototype.set_mark = function (line, ch, el) {
        this.cm.setBookmark({ line : line, ch : ch}, { widget : el, handleMouseEvents : true} );

    }

    codemirror_cubicbezier.prototype.render = function (cursor, lineNo, lineHandle, bezier) {

        var start = lineHandle.text.indexOf(bezier, cursor.next);

        cursor.next = start + bezier.length;

        if (this.has_marker(lineNo, start))
        {
            this.update_element(this.create_marker(lineNo, start), bezier);
            this.set_state(lineNo, start, bezier);
            return;
        }

        var el  = this.create_marker(lineNo, start);

        this.update_element(el, bezier);
        this.set_state(lineNo, start, bezier);
        this.set_mark(lineNo, start, el);
    }
});
