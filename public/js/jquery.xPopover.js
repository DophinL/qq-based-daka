/**
 * Created by hzliuzongyuan on 2015/11/11.
 * 没有提供content则不会显示popover
 */
(function ($, w) {
        if (!$) {
            throw new Error('该组件依赖于jQuery,请安装后再试');
        }

        $(document).on('mouseenter', '[data-popover]', function (e) {
            var $dep = $(e.target).closest('[data-popover]');
            var config = $dep.data('popover');

            //过滤
            if (typeof config !== 'object')
                return;
            if (!config.content)
                return;

            $dep.css('position')!=='static' || $dep.css('position','relative');

            var cachePopover = _findCache($dep);

            if (cachePopover) {
                if (config.title) {
                    cachePopover.find('.popover_title').length == 0 ? cachePopover.find('.m-popover').append('<div class="popover_title"></div>').html(config.title) : cachePopover.find('.popover_title').html(config.title);
                }
                if (config.content) {
                    cachePopover.find('.popover_cnt').length == 0 ? cachePopover.find('.m-popover').append('<div class="popover_cnt"></div>').html(config.content) : cachePopover.find('.popover_cnt').html(config.content);
                }
                cachePopover.show();
                return;
            }
            _initPopover($dep, config);
        })

        $(document).on('mouseleave', '[data-popover]', function (e) {
            var $dep = $(e.target).closest('[data-popover]');   //e可能是[data-popover]的后代
            var debug = $dep.data('popover') ? $dep.data('popover').debug : false;
            if (debug) {
                return;
            }
            var cache = _findCache($dep);
            if (cache) {
                cache.hide();
            }
        })

        function _initPopover($dep,config) {
            var title = config.title;
            var cnt = config.content;

            //模板
            var wrap_dom_start = '<div class="m-popover"><div class="popover_placeholder"></div> <div class="popover_arrow"></div>';
            var wrap_dom_end = '</div>';
            var title_dom = title ? '<h2 class="popover_title">' + title + '</h2>' : '';
            var cnt_dom = '<div class="popover_cnt">' + cnt + '</div>';
            var template = wrap_dom_start + title_dom + cnt_dom + wrap_dom_end;
            var $popover = $(template);

            //样式配置
            if(config.style){
                var wrapStyle = config.style.wrap;
                var titleStyle = config.style.title;
                var contentStyle = config.style.content;
                wrapStyle && $popover.css(wrapStyle);
                titleStyle && $popover.find('.popover_title').css(titleStyle);
                contentStyle && $popover.find('.popover_cnt').css(contentStyle);
            }
            $popover.appendTo($dep);

            //定位
            var depHeight = $dep.height();
            var depWidth = $dep.width();
            var popoverHeight = $popover.outerHeight();
            $popover.css('top', (depHeight - popoverHeight) / 2);
            $popover.css('left', depWidth - 10);
            $popover.show();
        }

        function _findCache($dep) {
            var $popover = $dep.find('.m-popover')
            if ($popover.length <= 0)
                return false
            return $popover;
        }
    }(jQuery, window)
)