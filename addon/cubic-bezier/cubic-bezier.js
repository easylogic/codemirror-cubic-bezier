(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
        mod(require("codemirror"));
    else if (typeof define == "function" && define.amd) // AMD
        define(["codemirror"], mod);
    else // Plain browser env
        mod(CodeMirror);
})(function(CodeMirror) {

    CodeMirror.defineExtension("cubicbezier", function () {

        var cm  = this;

        var bezier = {

            trim : function (str) {
                return str.replace(/^\s+|\s+$/g, '');
            },

            format : function(arr) {

                arr[0] = Math.floor(arr[0] * 100)/100;
                arr[1] = Math.floor(arr[1] * 100)/100;
                arr[2] = Math.floor(arr[2] * 100)/100;
                arr[3] = Math.floor(arr[3] * 100)/100;

                for(var i = 0, len  = bezierList.length; i < len; i++) {
                    var bezier = bezierList[i];

                    if (bezier[0] == arr[0] && bezier[1] == arr[1] && bezier[2] == arr[2] && bezier[3] == arr[3] && bezier[5] /* is support css timing function name */) {
                        return bezier[4]; // timing function name
                    }
                }

                return "cubic-bezier(" + [arr[0], arr[1], arr[2], arr[3]].join(",") + ")";
            },
            parse : function (str) {
                if (typeof str == 'string') {

                    if (str == 'linear' || str == 'ease' || str == 'ease-in' || str == 'ease-in-out' || str == 'ease-out') {
                        for(var i = 0 , len = bezierList.length; i < len; i++) {
                            if (bezierList[i][4] == str) {
                                return bezierList[i];           //  check timing function for cubic-bezier
                            }
                        }
                    } else {

                        var arr = str.replace("cubic-bezier", "").replace("(", "").replace(")", "").split(",");

                        for (var i = 0, len = arr.length; i < len; i++) {
                            arr[i] = parseFloat(this.trim(arr[i]));
                        }

                        return arr;
                    }


                }

                return str;

            },
            calc : {
                B1 : function (t) { return t*t*t },
                B2 : function (t) { return 3*t*t*(1-t) },
                B3 : function (t) { return 3*t*(1-t)*(1-t) },
                B4 : function (t) { return (1-t)*(1-t)*(1-t) }
            },

            create : function (C1, C2, C3, C4) {
                return function (p) {
                    var x = C1.x * bezier.calc.B1(p) + C2.x*bezier.calc.B2(p) + C3.x*bezier.calc.B3(p) + C4.x*bezier.calc.B4(p);
                    var y = C1.y * bezier.calc.B1(p) + C2.y*bezier.calc.B2(p) + C3.y*bezier.calc.B3(p) + C4.y*bezier.calc.B4(p);

                    return { x : x , y : y};
                }
            },

            createForPattern : function (str) {
                var bezierList = this.parse(str);

                var C1 = { x : 0, y : 0 };
                var C2 = { x : bezierList[0], y : bezierList[1] };
                var C3 = { x : bezierList[2], y : bezierList[3] };
                var C4 = { x : 1, y : 1 };

                return this.create(C1, C2, C3, C4);

            }
        };

        var $body, $root, $bezier, $canvas, $control, $pointer1, $pointer2;
        var $animationCanvas, $animation, $itemList , $item1, $item2, $item3 , $item1Canvas, $item2Canvas, $item3Canvas, $predefined, $left, $right, $text;
        var currentBezier = [0, 0, 1, 1], currentBezierIndex = 0;
        var timer, animationTimer, bezierList = [
            [ 0, 0, 1, 1, 'linear', true],
            [ 0.25, 0.1, 0.25, 1, 'ease', true],
            [ 0.42, 0, 1, 1, 'ease-in', true],
            [ 0, 0, 0.58, 1, 'ease-out', true],
            [  0.47, 0, 0.745, 0.715,  'ease-in-sine'],
            [  0.39, 0.575, 0.565, 1,  'ease-out-sine'],
            [  0.445, 0.05, 0.55, 0.95,  'ease-in-out-sine'],
            [  0.55, 0.085, 0.68, 0.53,  'ease-in-quad'],
            [  0.25, 0.46, 0.45, 0.94,  'ease-out-quad'],
            [  0.455, 0.03, 0.515, 0.955,  'ease-in-out-quad'],
            [ 0.55, 0.055, 0.675, 0.19, 'ease-in-cubic'],
            [ 0.215, 0.61, 0.355, 1, 'ease-out-cubic'],
            [ 0.645, 0.045, 0.355, 1, 'ease-in-out-cubic'],
            [ 0.895, 0.03, 0.685, 0.22, 'ease-in-quart'],
            [ 0.165, 0.84, 0.44, 1, 'ease-out-quart'],
            [ 0.77, 0, 0.175, 1, 'ease-in-out-quart']
        ];

        var DRAG_AREA = 50;

        var bezierObj = {
            "ease" : "cubic-bezier(0.25, 0.1, 0.25, 1)",
            "ease-in" : "cubic-bezier(0.42, 0, 1, 1)",
            "ease-out" : "cubic-bezier(0, 0, 0.58, 1)"
        };

        var cubicbezierCallback = function () {};
        var cubicbezierHideCallback = function () {};
        var counter = 0;
        var cached = {};
        var isCubicBezierShow = false;
        var isShortCut = false;
        var hideDelay = 2000;


        function dom(tag, className, attr) {

            if (typeof tag != 'string') {
                this.el = tag;
            } else {

                var el  = document.createElement(tag);

                this.uniqId = counter++;

                el.className = className;

                attr = attr || {};

                for(var k in attr) {
                    el.setAttribute(k, attr[k]);
                }

                this.el = el;
            }
        }

        dom.prototype.attr = function (key, value) {
            if (arguments.length == 2) {
                this.setAttribute(key, value);
            } else if (arguments.length == 1) {
                if (typeof key == 'string') {
                    return this.el.getAttribute(key);
                } else {
                    for(var k in key) {
                        this.el.setAttribute(k, key[k]);
                    }
                }
            }

            return this;
        }

        dom.prototype.toggleClass = function (cls) {
            if (this.hasClass(cls)) {
                this.removeClass(cls);
            } else {
                this.addClass(cls);
            }

            return this;
        }

        dom.prototype.removeClass = function (cls) {
            this.el.className = bezier.trim((" " + this.el.className + " ").replace(' ' + cls + ' ', ' '));
        }

        dom.prototype.hasClass = function (cls) {
            if (!this.el.className)
            {
                return false;
            } else {
                var newClass = ' ' + this.el.className + ' ';
                return newClass.indexOf(' ' + cls + ' ') > -1;
            }
        }

        dom.prototype.addClass = function (cls) {
            if (!this.hasClass(cls)) {
                this.el.className = this.el.className + " " + cls;
            }

        }

        dom.prototype.html = function (html) {
            this.el.innerHTML = html;

            return this;
        }

        dom.prototype.empty = function () {
            return this.html('');
        }

        dom.prototype.append = function (el) {

            if (typeof el == 'string') {
                this.el.appendChild(document.createTextNode(el));
            } else {
                this.el.appendChild(el.el || el);
            }

            return this;
        }

        dom.prototype.appendTo = function (target) {
            var t = target.el ? target.el : target;

            t.appendChild(this.el);

            return this;
        }

        dom.prototype.remove = function () {
            if (this.el.parentNode) {
                this.el.parentNode.removeChild(this.el);
            }

            return this;
        }

        dom.prototype.text = function () {
            return this.el.textContent;
        }

        dom.prototype.css = function (key, value) {
            if (arguments.length == 2) {
                this.el.style[key] = value;
            } else if (arguments.length == 1) {

                if (typeof key == 'string') {
                    return getComputedStyle(this.el)[key];
                } else {
                    var keys = key || {};
                    for(var k in keys) {
                        this.el.style[k] = keys[k];
                    }
                }

            }

            return this;
        }

        dom.prototype.offset = function () {
            var rect = this.el.getBoundingClientRect();

            return {
                top: rect.top + document.body.scrollTop,
                left: rect.left + document.body.scrollLeft
            };
        }

        dom.prototype.width = function () {
            return this.el.offsetWidth;
        }

        dom.prototype.height = function () {
            return this.el.offsetHeight;
        }

        dom.prototype.dataKey = function (key) {
            return this.uniqId + '.' + key;
        }

        dom.prototype.data = function (key, value) {
            if (arguments.length == 2) {
                cached[this.dataKey(key)] = value;
            } else if (arguments.length == 1) {
                return cached[this.dataKey(key)];
            } else {
                var keys = Object.keys(cached);

                var uniqId = this.uniqId + ".";
                return keys.filter(function (key) {
                    if (key.indexOf(uniqId) == 0) {
                        return true;
                    }

                    return false;
                }).map(function (value) {
                    return cached[value];
                })
            }

            return this;
        }

        dom.prototype.val = function (value) {
            if (arguments.length == 0) {
                return this.el.value;
            } else if (arguments.length == 1) {
                this.el.value = value;
            }

            return this;
        }

        dom.prototype.int = function () {
            return parseInt(this.val(), 10);
        }

        dom.prototype.show = function () {
            return this.css('display', 'block');
        }

        dom.prototype.hide = function () {
            return this.css('display', 'none');
        }


        function pos(e) {
            if (e.touches && e.touches[0]) {
                return e.touches[0];
            }

            return e;
        }


        function initBezier(newBezier) {

            if (!isCubicBezierShow) return;

            var t = newBezier || "cubic-bezier(0, 0, 1, 1)", bezierObj = bezier.parse(t);

            currentBezier = bezierObj;


            drawSampleCanvas($item1Canvas, $item1.attr('data-bezier'));
            drawSampleCanvas($item2Canvas, $item2.attr('data-bezier'));
            drawSampleCanvas($item3Canvas, $item3.attr('data-bezier'));

            initPointer();
            drawBezierCanvas();
        }

        function drawSampleCanvas($canvas, bezierString) {

            var tempBezier = bezier.parse(bezierObj[bezierString] || bezierString);

            var context = $canvas.el.getContext('2d');
            var width = $canvas.width();
            var height = $canvas.height();

            context.clearRect(0, 0, width, height);

            context.lineWidth = 2;
            context.strokeStyle = '#ac48ff';

            // Draw control handles
            context.beginPath();
            context.moveTo(0, height);
            context.lineTo((tempBezier[0] * width) | 0, (tempBezier[1] == 0 ? height : (1 - tempBezier[1]) * height) | 0);
            context.moveTo(width,0);
            context.lineTo((tempBezier[2] * width) | 0, (tempBezier[3] == 1 ? 0 : (1 - tempBezier[3] ) * height) | 0);
            context.stroke();
            context.closePath();

            context.lineWidth = 2;
            context.strokeStyle = '#000000';

            // Draw bezier curve
            context.beginPath();
            context.moveTo(0,height);   // 0, 0
            context.bezierCurveTo( (tempBezier[0] * width) | 0, (tempBezier[1] == 0 ? height : (1 - tempBezier[1]) * height) | 0, (tempBezier[2] * width) | 0, (tempBezier[3] == 1 ? 0 : (1 - tempBezier[3] ) * height) | 0, width, 0);
            context.stroke();
        }

        function drawPoint () {

            if (timer) clearTimeout(timer);
            if (animationTimer) clearTimeout(animationTimer);

            timer = setTimeout(function () {
                animationPoint ();
            }, 100);
        }

        function animationPoint () {

            var func = bezier.createForPattern(bezier.format(currentBezier));

            var context = $animationCanvas.el.getContext('2d');
            var width = $animationCanvas.width();
            var height = $animationCanvas.height();

            context.clearRect(0, 0, width, height);

            context.fillStyle = "rgba(163, 73, 164, 0.1)";
            context.strokeStyle = "rgba(163, 73, 164, 0.05)";
            context.lineWidth = 1;
            // Draw Guide Line

            var y = height/2;

            function start (i) {

                var pos = func(i);
                var x = 20 + (width-40) * pos.y;        // y

                context.beginPath();
                context.arc(x, y, 10, 0, 2*Math.PI);
                context.fill();
                context.stroke();
                context.closePath();

                if (i <= 0) {
                    return;
                }

                animationTimer = setTimeout(function () { start(i - 0.05); }, 50);
            }

            start(1);

        }

        function initPointer() {

            var width = $control.width();
            var height = $control.height();

            var left = currentBezier[0] * width;
            var top = (1 - currentBezier[1]) * height;

            $pointer1.css({
                left: left + 'px',
                top : top + 'px'
            });

            left = currentBezier[2] * width ;
            top = (1 - currentBezier[3]) * height;

            $pointer2.css({
                left: left + 'px',
                top : top + 'px'
            })
        }

        function addEvent (dom, eventName, callback) {
            dom.addEventListener(eventName, callback);
        }

        function removeEvent(dom, eventName, callback) {
            dom.removeEventListener(eventName, callback);
        }

        function EventPointer1MouseDown(e) {
            $pointer1.data('isDown', true);
        }

        function EventPointer2MouseDown(e) {
            $pointer2.data('isDown', true);
        }

        function EventLeftClick (e) {
            prevBezier();
        }

        function EventRightClick (e) {
            nextBezier();
        }

        function prevBezier() {

            if (currentBezierIndex == 0) {
                currentBezierIndex = bezierList.length - 1;
            }  else {
                --currentBezierIndex;
            }

            currentBezier = bezierList[currentBezierIndex];


            initEasingText();
            initPointer();
            drawBezierCanvas();

            cubicbezierCallback(bezier.format(currentBezier));

        }

        function nextBezier() {
            currentBezierIndex = (++currentBezierIndex) % bezierList.length;

            currentBezier = bezierList[currentBezierIndex];


            initEasingText();
            initPointer();
            drawBezierCanvas();

            cubicbezierCallback(bezier.format(currentBezier));
        }

        function initEasingText() {
            $text.html(currentBezier[4] || 'ease');
        }

        function initEvent() {
            addEvent($pointer1.el, 'mousedown', EventPointer1MouseDown);
            addEvent($pointer2.el, 'mousedown', EventPointer2MouseDown);

            addEvent($left.el, 'click', EventLeftClick);
            addEvent($right.el, 'click', EventRightClick);

            addEvent(document, 'mouseup', EventDocumentMouseUp);
            addEvent(document, 'mousemove', EventDocumentMouseMove);


            addEvent($item1.el, 'click', EventItem1Click);
            addEvent($item2.el, 'click', EventItem2Click);
            addEvent($item3.el, 'click', EventItem3Click);

            addEvent($animationCanvas.el, 'click', EventAnimationCanvasClick);
        }

        function destroy() {
            removeEvent($pointer1.el, 'mousedown', EventPointer1MouseDown);
            removeEvent($pointer2.el, 'mousedown', EventPointer2MouseDown);

            removeEvent($left.el, 'click', EventLeftClick);
            removeEvent($right.el, 'click', EventRightClick);

            removeEvent(document, 'mouseup', EventDocumentMouseUp);
            removeEvent(document, 'mousemove', EventDocumentMouseMove);


            removeEvent($item1.el, 'click', EventItem1Click);
            removeEvent($item2.el, 'click', EventItem2Click);
            removeEvent($item3.el, 'click', EventItem3Click);

            // remove color picker callback
            cubicbezierCallback = undefined;
            cubicbezierHideCallback = undefined;
        }

        function EventAnimationCanvasClick() {
            drawPoint();
        }

        function EventItem1Click ()  {
            var bezierString = $item1.attr('data-bezier');
            currentBezier = bezier.parse(bezierObj[bezierString] || bezierString);

            initPointer();
            drawBezierCanvas();
            cubicbezierCallback(bezier.format(currentBezier));
            $item1.addClass('selected');
            $item2.removeClass('selected');
            $item3.removeClass('selected');

        }


        function EventItem2Click ()  {
            var bezierString = $item2.attr('data-bezier');
            currentBezier = bezier.parse(bezierObj[bezierString] || bezierString);

            initPointer();
            drawBezierCanvas()
            cubicbezierCallback(bezier.format(currentBezier));

            $item2.addClass('selected');
            $item1.removeClass('selected');
            $item3.removeClass('selected');
        }

        function EventItem3Click ()  {
            var bezierString = $item3.attr('data-bezier');
            currentBezier = bezier.parse(bezierObj[bezierString] || bezierString);

            initPointer();
            drawBezierCanvas();
            cubicbezierCallback(bezier.format(currentBezier));

            $item3.addClass('selected');
            $item2.removeClass('selected');
            $item1.removeClass('selected');
        }


        function EventDocumentMouseUp (e) {
            $pointer1.data('isDown', false);
            $pointer2.data('isDown', false);
        }

        function EventDocumentMouseMove(e) {
            if ($pointer1.data('isDown')) {
                setPointer1(e);
            }

            if ($pointer2.data('isDown')) {
                setPointer2(e);
            }
        }

        function drawBezierCanvas() {
            var context = $canvas.el.getContext('2d');
            var width = $canvas.width();
            var height = $canvas.height();

            context.clearRect(0, 0, width, height);

            context.lineWidth = 2;
            context.strokeStyle = 'rgba(0, 0, 0, 0.03)';
            // Draw Guide Line

            context.beginPath();
            context.moveTo(0, height);
            context.lineTo(width, 0);
            context.stroke();
            context.closePath();

            context.strokeStyle = '#ac48ff';

            // Draw control handles
            context.beginPath();
            context.moveTo(0, height);
            context.lineTo((currentBezier[0] * width) | 0, (currentBezier[1] == 0 ? height : (1 - currentBezier[1]) * height) | 0);
            context.moveTo(width,0);
            context.lineTo((currentBezier[2] * width) | 0, (currentBezier[3] == 1 ? 0 : (1 - currentBezier[3] ) * height) | 0);
            context.stroke();
            context.closePath();

            context.lineWidth = 3;
            context.strokeStyle = '#000000';

            // Draw bezier curve
            context.beginPath();
            context.moveTo(0,height);   // 0, 0
            context.bezierCurveTo( (currentBezier[0] * width) | 0, (currentBezier[1] == 0 ? height : (1 - currentBezier[1]) * height) | 0, (currentBezier[2] * width) | 0, (currentBezier[3] == 1 ? 0 : (1 - currentBezier[3] ) * height) | 0, width, 0);
            context.stroke();



            drawPoint()
        }

        function setPosition($pointer, e) {
            var bheight = $root.height()-$pointer.width()*3;

            var width = $control.width();
            var height = $control.height();

            var drag_area_w = 0;
            var drag_area_h = Math.abs(bheight - height)/2;

            var minX = $control.offset().left;
            var maxX = minX + width;

            var minY = $control.offset().top;
            var maxY = minY + height;

            var p = pos(e);

            var x = p.clientX - minX;
            if (-drag_area_w > x) {
                x = -drag_area_w;
            } else if (p.clientX > maxX + drag_area_w) {
                x = maxX + drag_area_w - minX;
            }

            var y = p.clientY;
            if (0 > y) {
                y = 0;
            } else if (p.clientY > document.body.clientHeight) {
                y = document.body.clientHeight;
            }

            y -= minY;

            $pointer.css({
                left: x + 'px',
                top : y + 'px'
            });

            return { x : (x == 0 )? 0 : x / width, y : (y == height ) ? 0 : (height-y) / height };
        }

        function setPointer1(e) {

            var pos = setPosition($pointer1, e);

            currentBezier[0] = pos.x;
            currentBezier[1] = pos.y;

            drawBezierCanvas();

            cubicbezierCallback(bezier.format(currentBezier));
        }

        function setPointer2(e) {
            var pos = setPosition($pointer2, e);

            currentBezier[2] = pos.x;
            currentBezier[3] = pos.y;

            drawBezierCanvas();

            cubicbezierCallback(bezier.format(currentBezier));
        }



        function init() {
            $body = new dom(document.body);

            $root = new dom('div', 'codemirror-cubicbezier', {
                tabIndex : -1
            });
            $bezier = new dom('div', 'bezier');

            $canvas = new dom('canvas', 'bezier-canvas', { width: '150px', height : '150px'} );
            $control = new dom( 'div', 'control' );
            $pointer1 = new dom('div', 'pointer1' );
            $pointer2 = new dom('div', 'pointer2' );

            $animation = new dom('div', 'animation');

            $animationCanvas = new dom('canvas', 'animation-canvas', { width: '270px', height : '50px', 'title' : 'Click and Replay point animation'} );

            $animation.append($animationCanvas);

            $itemList = new dom('div', 'item-list');

            $item1 = new dom('div', 'item', { 'data-bezier': 'ease', 'title' : 'ease' });
            $item2 = new dom('div', 'item', { 'data-bezier': 'ease-in', 'title' : 'ease-in' });
            $item3 = new dom('div', 'item', { 'data-bezier': 'ease-out', 'title' : 'ease-out' });

            $item1Canvas = new dom('canvas', 'item-canvas', { width: '40px', height : '40px'} );
            $item2Canvas = new dom('canvas', 'item-canvas', { width: '40px', height : '40px'} );
            $item3Canvas = new dom('canvas', 'item-canvas', { width: '40px', height : '40px'} );

            $item1.append($item1Canvas);
            $item2.append($item2Canvas);
            $item3.append($item3Canvas);

            $itemList.append($item1);
            $itemList.append($item2);
            $itemList.append($item3);

            $predefined = new dom('div', 'predefined');

            $left = new dom('div', 'left').html('〈');
            $right = new dom('div', 'right').html('〉');
            $text = new dom('div', 'predefined-text').html('ease-in');


            $predefined.append($right);
            $predefined.append($left);
            $predefined.append($text);

            $control.append($pointer1);
            $control.append($pointer2);

            $bezier.append($canvas);
            $bezier.append($control);

            $root.append($predefined);
            $root.append($animation);
            $root.append($itemList);
            $root.append($bezier);

            initBezier();

        }

        function definePostion (opt) {

            var width = $root.width();
            var height = $root.height();

            // set left position for color picker
            var elementScreenLeft = opt.left - $body.el.scrollLeft ;
            if (width + elementScreenLeft > window.innerWidth) {
                elementScreenLeft -= (width + elementScreenLeft) - window.innerWidth;
            }
            if (elementScreenLeft < 0) { elementScreenLeft = 0; }

            // set top position for color picker
            var elementScreenTop = opt.top - $body.el.scrollTop ;
            if (height + elementScreenTop > window.innerHeight) {
                elementScreenTop -= (height + elementScreenTop) - window.innerHeight;
            }
            if (elementScreenTop < 0) { elementScreenTop = 0; }

            // set position
            $root.css({
                left : elementScreenLeft + 'px',
                top : elementScreenTop + 'px'
            });
        }

        /**
         * public methods
         */
        function show (opt, transition,  callback, hideCallback) {
            destroy();
            initEvent();
            $root.appendTo(document.body);

            $root.css({
                position: 'fixed',  // color picker has fixed position
                left : '-10000px',
                top : '-10000px'
            });

            $root.show()
            definePostion(opt);

            isCubicBezierShow = true;
            isShortCut = opt.isShortCut || false;

            initBezier(transition);

            // define cubicbezier callback
            cubicbezierCallback = function (transitionString) {
                callback(transitionString);
            }


            cubicbezierHideCallback = function () {
                hideCallback.call(null);
            }

            // define hide delay
            hideDelay = opt.hideDelay || 2000;
            if (hideDelay > 0) {
                setHideDelay(hideDelay);
            }


        }

        var timerCloseCubicBezier;
        function setHideDelay (delayTime) {
            delayTime = delayTime || 0;
            removeEvent($root.el, 'mouseenter');
            removeEvent($root.el, 'mouseleave');

            addEvent($root.el, 'mouseenter', function () {
                clearTimeout(timerCloseCubicBezier);
            });

            addEvent($root.el, 'mouseleave', function () {
                clearTimeout(timerCloseCubicBezier);
                timerCloseCubicBezier = setTimeout(hide, delayTime);
            });
        }

        function hide () {
            if (isCubicBezierShow) {
                destroy();
                $root.hide();
                $root.remove();
                isCubicBezierShow = false;
            }

        }

        init();

        return {
            isShortCut : function () {
                return isShortCut;
            },
            $root: $root,
            show: show,
            hide: hide
        }
    })

});
