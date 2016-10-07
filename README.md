# 基于QQ聊天记录的打卡应用



## 前言

这个项目核心逻辑是用正则匹配QQ聊天记录，生成格式的信息。已经在某群试用了半年左右，比较稳定。

之前有其它群的朋友问我怎么实现的，所以我先暂时把项目放出来。

不过由于之前做的时候没有考虑健壮性、安全性、可复用性等问题，所以如果要直接用的话请慎重。



## 使用步骤

一、

```bash
$ git clone git@github.com:DophinL/qq-based-daka.git
```



二、安装依赖

```bash
$ npm install
```



三、

```bash
$ cd qq-based-daka && npm insatll
```



四、创建一个leancloud项目，详情请参考[官方网站](https://leancloud.cn/)

![](http://oegl93v4v.bkt.clouddn.com/2016-10-07-17%3A34%3A49.jpg)



五、为项目添加一张Record表，用来保存每条上传记录

![](http://oegl93v4v.bkt.clouddn.com/2016-10-07-17%3A39%3A55.jpg)



字段有：

![](http://oegl93v4v.bkt.clouddn.com/2016-10-07-17%3A43%3A39.jpg)



六、配置项目域名（这步不能缺，否则上传的文件将不能通过url访问，导致程序出错）![](http://oegl93v4v.bkt.clouddn.com/2016-10-07-18%3A20%3A25.jpg)

![](http://oegl93v4v.bkt.clouddn.com/2016-10-07-18%3A21%3A08.jpg)



七、安装leancloud命令行工具，详情见[这里](https://leancloud.cn/docs/leanengine_cli.html#安装命令行工具)

```bash
$ npm install -g leancloud-cli
```



八、将本地项目关联到刚才在leancloud上创建的项目，详情见[这里](https://leancloud.cn/docs/leanengine_quickstart.html#从项目模板创建)

```bash
$ lean app add <appName> <appId>
```



九、启动本地项目

启动之前须先在package.json中红框位置处填写相关的key信息：

![](http://oegl93v4v.bkt.clouddn.com/2016-10-07-18%3A30%3A46.jpg)

这些Key在leancloud`项目 -> 设置 -> 应用Key` 中可见。

然后启动项目：

```bash
$ npm run up
```



十、从浏览器进入项目主页：localhost:3000

上传项目根目录下的测试文本，填写几个表单，点击生成打卡记录，这时候会提示你输入密码:

![](http://oegl93v4v.bkt.clouddn.com/2016-10-07-18%3A13%3A25.jpg)



输入test，提交表单，大功告成：

![](http://oegl93v4v.bkt.clouddn.com/2016-10-07-18%3A24%3A56.jpg)



之后想访问最新的一条记录，可以输入xxx/record/recent



如果要改密码请到app.js里面改：

![](http://oegl93v4v.bkt.clouddn.com/2016-10-07-18%3A15%3A08.jpg)

默认是`test`



十一、部署，最后一步

刚才项目都是在本地跑的，现在需要部署到leancloud上：

```bash
$ lean deploy
```



然后输入你事先设好的网址访问，结束。

