/**
 * Created by Dophin on 16/7/28.
 */
/**
 * Created by Dophin on 16/7/23.
 */
var router = require('express').Router();
var AV = require('leanengine');


router.get('/', function (req, res) {

    AV.Cloud.httpRequest({
        url: 'http://ac-ykgfkqnl.clouddn.com/f5de60a902421ef40577.txt'
    }).then(function (data) {

        var rules = [{
            category: '运动',
            add: {
                isOpen: true,
                format: '【打卡】',
                limit: 'today 00:00-today 21:53'    // 必须当日之内,不能为24:00
            },
            patch: {
                isOpen: true,
                format: '【补卡 %date%】',
                limit: 'today+1 00:00-today+1 23:59'    // 必须第二天后
            },
            del: {
                isOpen: false
            }
        },
        {
            category: '晨读',
            add: {
                isOpen: true,
                format: '【晨读打卡】',
                limit: 'today 00:00-today 21:54'
            },
            patch: {
                isOpen: true,
                format: '【晨读补卡 %date%】',
                limit: 'today+1 00:00-today+2 21:56'
            },
            del: {
                isOpen: false
            }
        }]

        var start = '2016-06-29';   // TODO 时间限制

        var end = '2016-07-06'; // TODO 时间限制

        /**
         * TODO 每条语句只有一个含义
         * @param data
         * @param rules
         * @param start
         * @param end
         * @returns ret     // [{category:'晨读',names:['dophin','jack'],dates:['2016-04-29','2016-04-30'],records:[[{isDaka:true,cnt:'cnt'}]]}]
         */
        function parseFile(data, rules, start, end) {

            var ret = [];

            // ?原本是贪婪的
            var reg = new RegExp('((\\d{4}-\\d{2}-\\d{2})\\s\\d{1,2}:\\d{2}:\\d{2})\\s\\s?' +  //日期
                '(?:【.*?】)?(.*?)' +  //名称
                '(?:\\(\\d+?\\))?' + //QQ
                '(?:(?:\\r\\n)|(?:\\n))' + //换行
                '(?:.|\\s)*?' +  //说话内容，.不能匹配换行符，所以需要和\s组合起来
                '(?=\\d{4}-\\d{2}-\\d{2}\\s\\d{1,2}:\\d{2}:\\d{2}\\s\\s?)', 'g'); //断言

            /*var analysis = {
             '晨读': {
             '2016-03-20': {
             'Dophin': '<打卡>test1',
             'Hugin': '<打卡>test2'
             },
             '2016-03-21': {
             'Dophin': '<打卡>test3',
             'Hugin': '<打卡>test4'
             }
             }
             }*/
            var analysis = {},
                names = [],
                dates = [],
                date = '',  // '2016-04-11'
                time = '',  // '2016-04-11 18:06'
                name = '',
                cnt = '',
                matchArr;   // 存储一个会话相关的信息,temp[0]为会话内容,temp[1]为时间,temp[2]为日期,temp[3]为名称

            /**
             * 判断时间点是否满足限制
             * @param time {string} 发送消息的时间,'2016-12-04 11:20:39'
             * @param targetDate {string} 目标时间(主要指补卡和删卡指定的时间),'2016-06-04'
             * @param limit {string} '08:30-22:01'
             * @returns {boolean}
             * @example isUnderLimit('2016-04-13 12:08','2016-04-13','today 10:00-today 14:00')
             */
            function isUnderLimit(time, targetDate, limit) {
                var tempArr = limit.split('-'),
                    leftBoundary = getTimeStamp(tempArr[0], targetDate),
                    rightBoundary = getTimeStamp(tempArr[1], targetDate);

                // speStr 'today+1 12:01'
                function getTimeStamp(speStr, targetDate) {

                    var reg = /today\+?(\d*)?\s(\d{2}:\d{2})/,
                        execResult = reg.exec(speStr);

                    if (!execResult[1]) {
                        execResult[1] = 0;
                    }

                    return +new Date(targetDate + ' ' + execResult[2]) + execResult[1] * 24 * 60 * 60 * 1000;
                }

                time = +new Date(time);

                if (time >= leftBoundary && (time <= rightBoundary)) {
                    return true;
                } else {
                    return false;
                }
            }

            // 设在该类目下,该人在该日打了一次卡,并记录该内容
            function setRecord(category, name, date, cnt) {
                analysis[category] || (analysis[category] = {});
                analysis[category][date] || (analysis[category][date] = {})
                analysis[category][date][name] = cnt;
            }

            // 只留下从起始日期开始的内容
            // data = data.substr(data.indexOf(start));

            // 每个循环正常情况会匹配到一个会话,最后一个会话会被忽略
            // 如果多个对话都出现关键字,那么以最后一个为准;如果一句话内出现多个相同关键字,以第一个为准
            while (matchArr = reg.exec(data)) {

                debugger;

                cnt = matchArr[0];
                time = matchArr[1];
                date = matchArr[2];
                name = matchArr[3];

                /*========== 打卡 ==========*/
                (function () {

                    for (var i = 0; i < rules.length; i++) {

                        // 如果打卡规则是打开的
                        if (rules[i].add.isOpen) {

                            // 如果存在打卡格式
                            if (cnt.includes(rules[i].add.format)) {

                                // 如果时间满足限制
                                if (isUnderLimit(time, date, rules[i].add.limit)) {
                                    setRecord(rules[i].category, name, date, cnt);
                                }
                            }
                        }
                    }
                })();

                /*========== 补卡 ==========*/
                (function () {

                    var reg,
                        matchArr;   // matchArr[1] '2016-01-01',为目标日期

                    for (var i = 0; i < rules.length; i++) {
                        reg = new RegExp(rules[i].patch.format.replace(/([\[\]])/g, '\\$1').replace(/%date%/, '(\\d{4}-\\d{2}-\\d{2})'));

                        // 如果补卡规则是打开的
                        if (rules[i].patch.isOpen) {

                            // 如果存在补卡格式
                            if (matchArr = reg.exec(cnt)) {

                                // 如果时间满足限制
                                if (isUnderLimit(time, matchArr[1], rules[i].patch.limit)) {
                                    setRecord(rules[i].category, name, matchArr[1], cnt);
                                }
                            }
                        }
                    }
                })();
            }
            res.json(analysis)

            return ret;
        }

        parseFile(data.text, rules, start, end);

        // 按照规则生成格式化数据

        // 渲染表格
    })
});


module.exports = router;
