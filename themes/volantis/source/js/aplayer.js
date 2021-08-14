// 检查 Aplayer 对象状态
function checkAPlayer() {
  if (APlayerController.player == undefined) {
    setAPlayerObject();
  } else {
    if (APlayerController.observer == undefined) {
      setAPlayerObserver();
    }
  }
}

// 设置全局播放器所对应的 aplyer 对象
function setAPlayerObject() {
  // 设置foot全局播放器为高优先级
  var Meting = document.querySelectorAll('.footer meting-js');
  if (Meting.length == 0) {
    Meting = document.querySelectorAll('meting-js');
  }
  Meting.forEach((item, index) => {
    if (item.meta.id == APlayerController.id) {
      if (Meting[index].aplayer != undefined) {
        APlayerController.player = Meting[index].aplayer;
        setAPlayerObserver();
        updateTitle();
      }
    }
  });
}

// 事件监听
function setAPlayerObserver() {
  try {
    APlayerController.player.on('play', function(e) {
      updateAPlayerControllerStatus();
    });
    APlayerController.player.on('pause', function(e) {
      updateAPlayerControllerStatus();
    });
    APlayerController.player.on('volumechange', function(e) {
      onUpdateAPlayerVolume();
    });
    APlayerController.player.on('loadstart', function(e) {
      // 跳到下一曲时更新标题
      updateTitle();
    });

    // 监听音量手势
    APlayerController.volumeBarWrap = document.getElementsByClassName('nav volume')[0].children[0];
    APlayerController.volumeBar = APlayerController.volumeBarWrap.children[0];
    function updateAPlayerVolume(e) {
      let percentage = ((e.clientX || e.changedTouches[0].clientX) - APlayerController.volumeBar.getBoundingClientRect().left) / APlayerController.volumeBar.clientWidth;
      percentage = Math.max(percentage, 0);
      percentage = Math.min(percentage, 1);
      APlayerController.player.volume(percentage);
    }
    const thumbMove = (e) => {
      updateAPlayerVolume(e);
    };
    const thumbUp = (e) => {
      APlayerController.volumeBarWrap.classList.remove('aplayer-volume-bar-wrap-active');
      document.removeEventListener('mouseup', thumbUp);
      document.removeEventListener('mousemove', thumbMove);
      updateAPlayerVolume(e);
    };

    APlayerController.volumeBarWrap.addEventListener('mousedown', () => {
      APlayerController.volumeBarWrap.classList.add('aplayer-volume-bar-wrap-active');
      document.addEventListener('mousemove', thumbMove);
      document.addEventListener('mouseup', thumbUp);
    });


    // 设置完监听就立即更新一次
    updateAPlayerControllerStatus();
    onUpdateAPlayerVolume();
    APlayerController.observer = true;
    console.log('APlayerController ready!');

  } catch (error) {
    delete APlayerController.observer;
  }
}

// 更新控制器状态
function updateAPlayerControllerStatus() {
  try {
    if (APlayerController.player.audio.paused) {
      document.getElementsByClassName('nav toggle')[0].children[0].classList.add('fa-play');
      document.getElementsByClassName('nav toggle')[0].children[0].classList.remove('fa-pause');
    } else {
      document.getElementsByClassName('nav toggle')[0].children[0].classList.remove('fa-play');
      document.getElementsByClassName('nav toggle')[0].children[0].classList.add('fa-pause');
    }
  } catch (error) {
    console.log(error);
  }
}
function onUpdateAPlayerVolume() {
  try {
    APlayerController.volumeBar.children[0].style.width = APlayerController.player.audio.volume * 100 + '%';
  } catch (error) {
    console.log(error);
  }
}

// 播放/暂停
function aplayerToggle() {
  checkAPlayer();
  try {
    APlayerController.player.toggle();
  } catch (error) {
    console.log(error);
  }
}

// 上一曲
function aplayerBackward() {
  checkAPlayer();
  try {
    APlayerController.player.skipBack();
    APlayerController.player.play();
  } catch (error) {
    console.log(error);
  }
}

// 下一曲
function aplayerForward() {
  checkAPlayer();
  try {
    APlayerController.player.skipForward();
    APlayerController.player.play();
  } catch (error) {
    console.log(error);
  }
}

// 调节音量
function aplayerVolume(percent) {
  checkAPlayer();
  try {
    APlayerController.player.volume(percent);
  } catch (error) {
    console.log(error);
  }
}

// 更新音乐标题
function updateTitle() {
  checkAPlayer();
  try {
    const index = APlayerController.player.list.index;
    const obj = APlayerController.player.list.audios[index];
    document.getElementsByClassName('nav music-title')[0].innerHTML = obj.title;
  } catch (error) {
    console.log(error);
  }
}
var checkrightmenu = setInterval(function() {
  if (!volantis.APlayerLoaded) return; // APlayer加载完成？
  if ($('#safearea').css('display') != 'block') return; // 文章内容加载完成？ see: source/css/first.styl
  if (!document.querySelectorAll('meting-js')[0].meta) return; // meting-js 加载完成？
  if (!document.querySelectorAll('meting-js')[0].meta.id) return; // meting-js 初始化?
  clearInterval(checkrightmenu);
  checkAPlayer();
}, 1000);

