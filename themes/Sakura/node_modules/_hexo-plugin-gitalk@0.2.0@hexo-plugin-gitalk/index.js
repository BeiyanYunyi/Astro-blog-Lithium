hexo.extend.filter.register('after_post_render', function(data) {
	var gitalkConfig = hexo.config.plugins.gitalk;
	if (gitalkConfig) {
		data.content = data.content + '\n<div id="gitalk-container"></div>\n<script src="https://cdn.bootcss.com/blueimp-md5/2.12.0/js/md5.min.js"></script><link rel="stylesheet" href="https://unpkg.com/gitalk/dist/gitalk.css"><script src="https://unpkg.com/gitalk/dist/gitalk.min.js"></script>';
		var str = `
		<script>
		var gitalkConfig = ${JSON.stringify(gitalkConfig)};
	    gitalkConfig.id = md5(location.pathname);
		var gitalk = new Gitalk(gitalkConfig);
	    gitalk.render("gitalk-container");
	    </script>`;
		
		data.content = data.content + '\n' + str;
	}

	return data;
});