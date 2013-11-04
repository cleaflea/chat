
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());

app.use(express.cookieParser());

app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

// app.get('/', routes.index);
// app.get('/users', user.list);
//放在这个地方就悲剧了，每次有websocket连接过来都会触发这个初始化users的代码
// var users = {};//存储在线用户列表的对象

app.get('/', function (req, res) {
	console.log(req.cookies);
  if (req.cookies.user == null) {
    res.redirect('/signin');
  } else {
  	//如果不是模板引擎就不需要res.render了，直接向前端发送一个静态文件就ok了
    res.sendfile('views/index.html');
  }
});
app.get('/signin', function (req, res) {
  res.sendfile('views/signin.html');
});
app.post('/signin', function (req, res) {
  if (users[req.body.name]) {
    //存在，则不允许登陆
    res.redirect('/signin');
  } else {
    //不存在，把用户名存入 cookie 并跳转到主页
    res.cookie("user", req.body.name, {maxAge: 1000*60*60*24*30});
    console.log(req.cookies);
    res.redirect('/');
  }
});

var server = http.createServer(app);
var io = require('socket.io').listen(server);

/*
socket.emit() ：向建立该连接的客户端广播
socket.broadcast.emit() ：向除去建立该连接的客户端的所有客户端广播
io.sockets.emit() ：向所有客户端广播，等同于上面两个的和
*/
/*
socket.io 提供了三种默认的事件（客户端和服务器都有）：connect 、message 、disconnect 。
当与对方建立连接后自动触发 connect 事件，
当收到对方发来的数据后触发 message 事件（通常为 socket.send() 触发），
当对方关闭连接后触发 disconnect 事件。
*/
var users = {};//存储在线用户列表的对象

io.sockets.on('connection', function (socket) {
	//有人上线
	socket.on('online', function (data) {
	  //将上线的用户名存储为 socket 对象的属性，以区分每个 socket 对象，方便后面使用
	  console.log('data.user===>' + data.user);
	  console.log('socket.name===>' + socket.name);
	  socket.name = data.user;
	  console.log('socket.name===>' + socket.name);
	  console.log(users);
	  //users 对象中不存在该用户名则插入该用户名
	  if (!users[data.user]) {
	    users[data.user] = data.user;
	  }
	  console.log(users);
	  //向所有用户广播该用户上线信息
	  io.sockets.emit('online', {users: users, user: data.user});
	});
	//有人发话
	socket.on('say', function (data) {
	  if (data.to == 'all') {
	    //向其他所有用户广播该用户发话信息
	    socket.broadcast.emit('say', data);
	  } else {
	    //向特定用户发送该用户发话信息
	    //clients 为存储所有连接对象的数组
	    var clients = io.sockets.clients();
	    //遍历找到该用户
	    clients.forEach(function (client) {
	      if (client.name == data.to) {
	        //触发该用户客户端的 say 事件
	        client.emit('say', data);
	      }
	    });
	  }
	});
	//有人下线
	socket.on('disconnect', function () {
	  //若 users 对象中保存了该用户名
	  // console.log('delete data.name===>' + data.name);
	  console.log('delete socket.name===>' + socket.name);
	  if (users[socket.name]) {
	  	// alert('delete socket.name===>' + socket.name);
	    //从 users 对象中删除该用户名
	    delete users[socket.name];
	    //向其他所有用户广播该用户下线信息
	    socket.broadcast.emit('offline', {users: users, user: socket.name});
	  }
	});
});
server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

