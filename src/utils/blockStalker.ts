const uaList = [
  'Mozilla/5.0 (Linux; Android 9; EML-AL00; HMSCore 6.15.0.301; GMSCore 14.7.99) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.196 HuaweiBrowser/16.0.3.30036 (KHTML, like Gecko) Chrome/114.0.5735.196 HuaweiBrowser/16.0.3.300 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_2 like Mac OS X) AppleWebKit/605.1.15(iPhone; CPU iPhone OS 15_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.2 Mobile/15E148 Safari/604.1',
];
if (uaList.includes(navigator.userAgent)) {
  alert(
    'You are using a blocked user agent. Please use a different browser or device.\n' +
      "If you don't close this page immediately, your browser may crash after a while.",
  );
  while (true) {
    addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    });
  }
}
