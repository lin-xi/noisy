Template.postsList.helpers({
	posts: function () {
		return Posts.find({}, {
			sort: {
				time: 1
			}
		});
	}
});

Template.voiceItem.helpers({
	fileSize: function () {
		return (this.content.size / 1024).toFixed(2);
	}
});

Template.postsList.events({
	'mouseenter #voiceChat': function (e, t) {
		var vp = t.find('.voice-panel');
		vp.style.display = 'block';
	},

	'mouseleave .voice-panel': function (e, t) {
		var stat = t.find('.ctrl-btn').getAttribute('state');
		if (stat == 'stop') {
			e.currentTarget.style.display = 'none';
		}
	},

	'click .ctrl-btn': function (e, t) {
		var cur = e.currentTarget;
		var canvas = t.find('.voiceWave');
		var audio = t.find('.sound');

		var stat = cur.getAttribute('state');
		switch (stat) {
			case 'play':
				cur.className = 'icon-reco ctrl-btn';
				cur.setAttribute('state', 'stop');
				recorder.stop();

				var blob = recorder.getBlob();
				// download(blob);
				BinaryFileReader.read(blob, function (err, fileInfo) {
					if (err) {
						alert(err);
					} else {
						var data = {
							type: 2,
							user: 'images/avatar.png',
							content: fileInfo
						};
						postData(data, function () {

						});
					}
				});
				break;
			case 'stop':
				cur.className = 'icon-stop ctrl-btn';
				cur.setAttribute('state', 'play');
				recorder.start(canvas, audio);
				break;
		}
	},

	'click .play-btn': function (e, t) {
		var cur = e.currentTarget;

		var stat = cur.getAttribute('state');
		switch (stat) {
			case 'play':
				break;
			case 'stop':
				var audio = document.createElement('audio');
				var file = this.content;
				audio.addEventListener('ended', function () {
					cur.setAttribute('state', 'stop');
					// document.body.removeChild(audio);
				});
				var blob = new Blob([file.file], {
					type: file.type
				});
				audio.src = URL.createObjectURL(blob);
				audio.controls = true;
				audio.play();
				document.body.appendChild(audio);
				cur.setAttribute('state', 'play');
				break;
		}
	},

	'keydown .chat-input': function (e, t) {
		var tar = e.target;
		if (e.which == 13) {
			if (tar.innerHTML) {
				var post = {
					type: 1,
					user: 'images/avatar.png',
					content: tar.innerHTML
				};
				postData(post, function () {
					tar.innerHTML = '';
				});
			}

			e.preventDefault();
			e.stopPropagation();
		}
	}
});


function postData(data, func) {
	Meteor.call('postInsert', data, function (error, result) {
		if (error) {
			alert(JSON.stringify(error));
		} else {
			func && func();
		}
	});
}

var BinaryFileReader = {
	read: function (file, callback) {
		var reader = new FileReader;
		var fileInfo = {
			name: file.name,
			type: file.type,
			size: file.size,
			file: null
		}
		reader.onload = function () {
			fileInfo.file = new Uint8Array(reader.result);
			callback(null, fileInfo);
		}
		reader.onerror = function () {
			callback(reader.error);
		}
		reader.readAsArrayBuffer(file);
	}
};

function download(blob) {
	var a = document.createElement("a");
	a.href = URL.createObjectURL(blob);
	a.download = new Date().getTime();
	document.body.appendChild(a);
	a.click();
}