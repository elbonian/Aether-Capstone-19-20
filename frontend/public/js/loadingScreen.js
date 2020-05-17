/*
    Functions that are responsible for creating and removing a loading screen overlay.
    Special thanks to Jared Goodwin for the code.

    ATTRIBUTIONS:
        Author: Jared Goodwin
        Source: https://stackoverflow.com/questions/19315149/implementing-a-loading-spinning-wheel-in-javascript
*/

// Author: Jared Goodwin
// showLoading() - Display loading wheel.
// Requires ECMAScript 6 (any modern browser).
function showLoading() {
    if (document.getElementById("divLoadingFrame") != null) {
        return;
    }
    var style = document.createElement("style");
    style.id = "styleLoadingWindow";
    style.innerHTML = `
        .loading-frame {
            position: fixed;
            background-color: rgba(0, 0, 0, 0.8);
            left: 0;
            top: 0;
            right: 0;
            bottom: 0;
            z-index: 4;
        }

        .loading-track {
            height: 50px;
            display: inline-block;
            position: absolute;
            top: calc(50% - 50px);
            left: 50%;
        }

        .loading-dot {
            height: 5px;
            width: 5px;
            background-color: white;
            border-radius: 100%;
            opacity: 0;
        }

        .loading-dot-animated {
            animation-name: loading-dot-animated;
            animation-direction: alternate;
            animation-duration: .75s;
            animation-iteration-count: infinite;
            animation-timing-function: ease-in-out;
        }

        @keyframes loading-dot-animated {
            from {
                opacity: 0;
            }

            to {
                opacity: 1;
            }
        }
    `
    document.body.appendChild(style);
    var frame = document.createElement("div");
    frame.id = "divLoadingFrame";
    frame.classList.add("loading-frame");
    for (var i = 0; i < 10; i++) {
        var track = document.createElement("div");
        track.classList.add("loading-track");
        var dot = document.createElement("div");
        dot.classList.add("loading-dot");
        track.style.transform = "rotate(" + String(i * 36) + "deg)";
        track.appendChild(dot);
        frame.appendChild(track);
    }
    document.body.appendChild(frame);
    var wait = 0;
    var dots = document.getElementsByClassName("loading-dot");
    for (var i = 0; i < dots.length; i++){
        window.setTimeout(function (dot) {
            dot.classList.add("loading-dot-animated");
        }, wait, dots[i]);
        wait += 150;
    }
};

// Author: Jared Goodwin
// removeLoading() - Remove loading wheel.
// Requires ECMAScript 6 (any modern browser).
function removeLoading() {
    if(document.getElementById("divLoadingFrame")){
        document.body.removeChild(document.getElementById("divLoadingFrame"));
        document.body.removeChild(document.getElementById("styleLoadingWindow"));
    }
};