/**
 * Created by Anja Sonnenberg on 22.09.2015.
 *
 * See the file "LICENSE.txt" for the full license and copyright governing this code.
 *
 */

(function ($) {
    var view = new View();
    $(window)
        .ready(function () {
            view.draw();
        })
        .load(function () {
            $(".scroll").mCustomScrollbar({
                "theme": "dark-thick",
                "autoHideScrollbar": false,
                scrollButtons: {
                    enable: true
                },
                advanced: {
                    updateOnContentResize: true
                }
            });
            $('#modalBody').css('max-height', $(window).height() - 180);
        })
        .on("resize", function () {
            $('#modalBody').css('max-height', $(window).height() - 180);
            view.subElements.graphPanel.init();
            view.event.load(view.data.url, true);
        })
        .bind("popstate", function () {
            view.event.load(location.toString());
        });

})(jQuery);