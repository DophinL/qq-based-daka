'use strict';
var domain = require('domain');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var cloud = require('./cloud');
var AV = require('leanengine');
var formidable = require('formidable');
var fs = require('fs');
var app = express();
var pwd = 'test';

// 设置 view 引擎
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// 加载云代码方法
app.use(cloud);

// 使用 LeanEngine 中间件
// （如果没有加载云代码方法请使用此方法，否则会导致部署失败，详细请阅读 LeanEngine 文档。）
// app.use(AV.Cloud);

// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());

// 未处理异常捕获 middleware
app.use(function (req, res, next) {
    var d = null;
    if (process.domain) {
        d = process.domain;
    } else {
        d = domain.create();
    }
    d.add(req);
    d.add(res);
    d.on('error', function (err) {
        console.error('uncaughtException url=%s, msg=%s', req.url, err.stack || err.message || err);
        if (!res.finished) {
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json; charset=UTF-8');
            res.end('uncaughtException');
        }
    });
    d.run(next);
});

app.get('/', function (req, res) {
    var query = new AV.Query('Record');
    query.addDescending('createdAt');
    query.limit(1);
    query.find().then(function (records) {
        res.render('patern', {
            _start: records.length?records[0].get('start'):'',
            _end: records.length?records[0].get('end'):'',
            _keyword: records.length?records[0].get('keyword'):'',
            _patchKeyword: records.length?records[0].get('patchKeyword'):'',
            _delKeyword: records.length?records[0].get('delKeyword'):''
        });
    }, function (err) {
        throw err;
    })
});

//新建record
app.post('/record', function (req, res) {

    var form = new formidable.IncomingForm();
    form.uploadDir = './temp';

    form.parse(req, function (err, fields, files) {

        if (err) {
            fs.unlink(files['txt'].path);
            throw err;
        }

        // 上传文件所需的密码
        if (fields.pwd != pwd) {
            res.send('密码错误请重新输入!');
            return;
        }

        fs.readFile(files['txt'].path, 'utf-8', function (err, data) {

            if (err) {
                fs.unlink(files['txt'].path);
                throw err;
            }

            var file = new AV.File(files['txt'].name, new Buffer(data));

            var record = new AV.Object('Record');

            //配置项
            record.save({
                start: fields.start,
                end: fields.end,
                keyword: fields.keyword,
                patchKeyword: fields.patchKeyword,
                delKeyword:fields.delKeyword,
                file: file
            }).then(function (record) {
                fs.unlink(files['txt'].path, function (err) {
                    if (err) {
                        throw err;
                    }
                    res.redirect('/record/' + record.id);
                });
            }, function (err) {
                fs.unlink(files['txt'].path);
                throw err;
            })

        })

    });
});


//获取record
app.get('/record/:id', function (req, res) {
    var id = req.params.id;

    var query = new AV.Query('Record');

    if (id == 'recent') {
        query.addDescending('createdAt');
        query.limit(1);
        query.find().then(function (records) {
            res.redirect('/record/' + records[0].id)
        }, function (err) {
            throw err;
        })

        return;
    }

    var query = new AV.Query('Record');

    query.include('file');

    query.get(id).then(function (record) {

        //向文件链接发送请求,目的是得到text
        AV.Cloud.httpRequest({
            url: record.get('file').url()
        }).then(function (data) {

            var keyword = record.get('keyword');
            var patchKeyword = record.get('patchKeyword').replace(/([\[\]])/g, '\\$1').replace(/%date%/, '(\\d{4}-\\d{2}-\\d{2})');
            var delKeyword = record.get('delKeyword').replace(/([\[\]])/g, '\\$1').replace(/%date%/, '(\\d{4}-\\d{2}-\\d{2})');
            var start = new Date(record.get('start'));
            var end = new Date(record.get('end'));
            /*var names = (function () {
                var reg = /^.+$/mg,
                    temp,
                    names = [];

                //被匹配的字符串是每行一个名字
                while (temp = reg.exec(record.get('names'))) {
                    names.push(temp[0]);
                }

                return names;
            })()*/

            // ?原本是贪婪的
            var reg = new RegExp('(\\d{4}-\\d{2}-\\d{2})\\s\\d{1,2}:\\d{2}:\\d{2}\\s\\s?'+  //日期
            '(?:【.*?】)?(.*?)'+  //姓名
            '(?:\\(\\d+?\\))?'+ //QQ
            '(?:(?:\\r\\n)|(?:\\n))'+ //换行
            '((?:.|\\s)*?)'+  //说话内容，.不能匹配换行符，所以需要和\s组合起来
            '(?=\\d{4}-\\d{2}-\\d{2}\\s\\d{1,2}:\\d{2}:\\d{2}\\s\\s?)', 'g'); //断言

            /*var analysis = {
             '2016-03-20': {
             'Dophin': '<打卡>test1',
             'Hugin': '<打卡>test2'
             },
             '2016-03-21': {
             'Dophin': '<打卡>test3',
             'Hugin': '<打卡>test4'
             }
             }*/
            var analysis = {},
                names = {};
            var temp,   //临时存放正常情况下的exec数组
                patch,  //临时存放补卡情况下的exec数组
                del,    //临时存放删卡情况下的exec数组
                lastIndex;

            // 每个循环正常情况会匹配到一个会话,最后一个会话会被忽略
            // 如果多个对话都出现关键字,那么以最后一个为准;如果一句话内出现多个相同关键字,以第一个为准
            // temp[1]为日期，temp[2]为姓名，temp[3]为内容
            while (temp = reg.exec(data.text)) {
                lastIndex = reg.lastIndex;

                //处理特殊情况
                if(temp[2] == '()' || temp[2] == '0')
                  continue;

                names[temp[2]] = null;

                //删卡
                if (del = new RegExp(delKeyword).exec(temp[3])) {
                    analysis[del[1]] && (delete analysis[del[1]][del[2]]);
                    //console.log(temp[0],'====删卡操作'+del[0]+'====\n\n\n');
                    continue;
                }

                //补卡
                if (patch = new RegExp(patchKeyword).exec(temp[3])) {
                    temp[1] = patch[1];
                    analysis[temp[1]] || (analysis[temp[1]] = {});
                    analysis[temp[1]][temp[2]] = temp[3];
                    //console.log(temp[0],'====补卡操作'+patch[0]+'====\n\n\n');
                    continue;
                }

                //打卡
                if (temp[3].indexOf(keyword) != -1) {   //意味着这个会话的含义是打卡
                    analysis[temp[1]] || (analysis[temp[1]] = {});
                    analysis[temp[1]][temp[2]] = temp[3];
                    //console.log(temp[0],'====打卡操作'+temp[1]+'====\n\n\n');
                }
            }

            //对最后一个会话进行专门的处理
            reg = new RegExp('(\\d{4}-\\d{2}-\\d{2})\\s\\d{1,2}:\\d{2}:\\d{2}\\s\\s?(.*?)(?:\\(\\d+?\\))?(?:(?:\\r\\n)|(?:\\n))((?:.|\\s)*)');
            temp = data.text.substr(lastIndex);
            temp = reg.exec(temp);

            names[temp[2]] = null;

            if(del = new RegExp(delKeyword).exec(temp[3])){
                analysis[del[1]] && (delete analysis[del[1]][del[2]]);
                //console.log(temp[0],'====删卡操作'+del[0]+'====\n\n\n');
            }
            else if (patch = new RegExp(patchKeyword).exec(temp[3])) { //补卡
                temp[1] = patch[1];
                analysis[temp[1]] || (analysis[temp[1]] = {});
                analysis[temp[1]][temp[2]] = temp[3];
                //console.log(temp[0],'====补卡操作'+patch[0]+'====\n\n\n');
            } else if (temp[3].indexOf(keyword) != -1) {   //打卡
                analysis[temp[1]] || (analysis[temp[1]] = {});
                analysis[temp[1]][temp[2]] = temp[3];
                //console.log(temp[0],'====打卡操作'+temp[1]+'====\n\n\n');
            }

            res.render('display', {
                _keyword: keyword,
                _patchKeyword: record.get('patchKeyword'),
                _delKeyword: record.get('delKeyword'),
                _start: record.get('start'),
                _end: record.get('end'),
                names: names,
                file: {
                    name: record.get('file').name(),
                    url: record.get('file').url()
                },
                date: {
                    start: start,
                    end: end,
                    days: (function () {
                        return Math.ceil((end - start) / (24 * 60 * 60 * 1000));
                    })()
                },
                analysis: analysis,
                //格式化日期
                formatDate: function (d) {
                    d = new Date(d);
                    var mon = d.getMonth() + 1, date = d.getDate();
                    mon = mon < 10 ? '0' + mon : mon;
                    date = date < 10 ? '0' + date : date;
                    return d.getFullYear() + "-" + mon + "-" + date;
                }
            });

        }, function (err) {
            console.log('请求错了:',err);
            throw err;
        });
    }, function (err) {
        throw err;
    })

})

//更新record
app.patch('/record/:id', function (req, res) {
    var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields) {

        if (err) {
            throw err;
        }

        if (fields.pwd != pwd) {
            res.json({code: 1, msg: '密码错误请重新输入!'})
            return;
        }

        var post = AV.Object.createWithoutData('Record', req.params.id);
        post.save({
            start: fields.start,
            end: fields.end,
            keyword: fields.keyword,
            patchKeyword: fields.patchKeyword,
            delKeyword: fields.delKeyword
        }).then(function () {
            res.json({code: 200, msg: '保存成功'})
        }, function (err) {
            res.json({code: err.code, msg: err.message})
        });

    });
})

// 如果任何路由都没匹配到，则认为 404
// 生成一个异常让后面的 err handler 捕获
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// 如果是开发环境，则将异常堆栈输出到页面，方便开发调试
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) { // jshint ignore:line
        var statusCode = err.status || 500;
        if (statusCode === 500) {
            console.error(err.stack || err);
        }
        res.status(statusCode);
        res.render('error', {
            message: err.message || err,
            error: err
        });
    });
}

// 如果是非开发环境，则页面只输出简单的错误信息
app.use(function (err, req, res, next) { // jshint ignore:line
    res.status(err.status || 500);
    res.render('error', {
        message: err.message || err,
        error: {}
    });
});

module.exports = app;
