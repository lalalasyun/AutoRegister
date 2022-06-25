const electron = require('electron');
const { dialog } = require('electron')

const fs = require('fs');
const readline = require("readline");


const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const dom = new JSDOM(`<html><body><div id="aaa">AAA<div></body></html>`);
const jquery = require('jquery');
const $ = jquery(dom.window);

var id = "", pass = "", token = "", userId = "";


let tray = null;  // GC でトレイアイコンが消えないようにする

var nowDay; //今日の日付
var isPlay = false;
var isLoad = false;
var hour = 6;

const doubleboot = electron.app.requestSingleInstanceLock();
if (!doubleboot) {
  electron.app.quit();
}

loadEvent(); //起動時のイベント
function loadEvent() {
  loadFile();

  setInterval(function () {
    //fileが読み込まれるまで待機
    if (isLoad) {
      login(); //tokenを取得
      clearInterval(this);
    }
  }, 100);

  setInterval(function () {
    //tokenが取得されるまで待機
    if (token !== "" && userId !== "") {
      clearInterval(this);
      $.ajax({
        type: "GET",
        url: "https://api.leber11.com/v9/temperatures?page=1",
        headers: {
          'x-user-token': token
        }
      }).done(function (json) {

        var now = new Date();
        var h = now.getHours();
        nowDay = now.getDate();
        getDay = json['result'][0]['date'].split(/[-T:]/)[2];

        //今日の登録がされていない時に登録する
        if (nowDay != getDay && h >= hour) {
          console.log('Not registered today');
          console.log('registered');
          $.ajax({
            type: "POST",
            url: "https://api.leber11.com/v9/patients/" + userId + "/submit_temperatures",
            data: getJsonData(),
            contentType: "application/json",
            headers: {
              'x-user-token': token
            }
          })
        }

        isPlay = true;

      })
    }
  }, 100);

  setInterval(function () {
    var now = new Date();
    const h = now.getHours();
    const d = now.getDate();

    if(d != nowDay){
      isPlay = false;
      nowDay = d;
    }

    if (h == hour && !isPlay) {
      $.ajax({
        type: "POST",
        url: "https://api.leber11.com/v9/patients/" + userId + "/submit_temperatures",
        data: getJsonData(),
        contentType: "application/json",
        headers: {
          'x-user-token': token
        }
      }).done(function (json) {
        if(json['status'] == 2 || json['status'] == 404){
          //tokenまたはIDが違う
          login();//再取得
          console.log('token error')
        }else{
          console.log('registered');
          isPlay = true;
        }
      });
    }

  }, 60000);//1分起き

}


function login() {
  $.ajax({
    type: "POST",
    url: "https://api.leber11.com/v9/users/sign_in",
    data: getLoginJson(),
    contentType: "application/json"
  }).done(function (json) {
    if (json['status'] == 1) {
      console.log('login info')
      //ログインに成功
      token = json['result']['user']['authentication_token'];
      userId = json['result']['user']["patients"][0]['id'];

      console.log('id:'+id);
      console.log('pass:'+pass);
      console.log('hour:'+hour);
      console.log('token:'+token);
      console.log('userid:'+userId);
      console.log();


    } else {
      //ログインに失敗
      dialog.showErrorBox('Login Error', 'ログインに失敗しました');
      electron.app.quit();
    }

  })
}

function loadFile() {
  const stream = fs.createReadStream("config.txt", {
    encoding: "utf8",         // 文字コード
  });

  // readlineにStreamを渡す
  const reader = readline.createInterface({ input: stream });
  reader.on("line", (data) => {
    if (data.indexOf('"') !== -1) {
      if (data.indexOf('id') !== -1) {
        var val = data.split(/["]/)[1];
        if (data !== val) {
          tel = val;
          id = '+81' + val.slice(1);
        }
      }
      if (data.indexOf('password') !== -1) {
        var val = data.split(/["]/)[1];
        if (data !== val) {
          pass = val;
        }
      }
      if (data.indexOf('hour') !== -1) {
        var val = data.split(/["]/)[1];
        if (data !== val && val !== "") {
          hour = Number(val);
          if(hour < 0 && hour > 23){
            //入力が違う場合
            hour = 6;
          }
        }
      }
    }

  });
  isLoad = true;

}


function getLoginJson() {
  data = {
    "login": id,
    "password": pass
  };
  return JSON.stringify(data);

}

function getJsonData() {
  const temp = Math.floor(Math.random() * 6) + 20;
  const time = 112 + hour;

  var now = new Date();
  var d = now.getDay();
  const day = d == 0 || d ==6 ? 159 : 156;

  data = {
    "temp_answers_attributes": [
      {
        "question_id": 1,
        "additional_comment": "",
        "answer_id": [
          temp
        ],
        "question_number": 1
      },
      {
        "question_id": 2,
        "additional_comment": "",
        "answer_id": [
          time
        ],
        "question_number": 2
      },
      {
        "question_id": 6,
        "additional_comment": "",
        "answer_id": [
          162
        ],
        "question_number": 6
      },
      {
        "question_id": 3,
        "additional_comment": "",
        "answer_id": [
          136
        ],
        "question_number": 3
      },
      {
        "question_id": 5,
        "additional_comment": "",
        "answer_id": [
          day
        ],
        "question_number": 5
      }
    ]
  };
  return JSON.stringify(data);
}



electron.app.on('ready', () => {
  // Mac のみ Dock は非表示にする
  if (process.platform === 'darwin') electron.app.dock.hide();

  // ビルド後にパスが狂わないよう `__dirname` を使う
  tray = new electron.Tray(`${__dirname}/icon-16.png`);
  tray.setContextMenu(electron.Menu.buildFromTemplate([
    {
      label: 'Exit',
      role: 'quit'
    }
  ]));
  tray.setToolTip('AutoRegister');
});