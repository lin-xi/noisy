(function () {
	function Recorder(config) {
		this.config = config || {};
		this.config.sampleBits = this.config.sampleBits || 8; //采样数位 8, 16
		this.config.sampleRate = this.config.sampleRate || (44100 / 6); //采样率(1/6 44100)
	}

	Recorder.prototype.init = function () {
		var me = this;
		var context = me.context = new window.AudioContext();
		var source = me.source = context.createMediaStreamSource(me.stream);
		var createScript = me.context = context.createScriptProcessor || context.createJavaScriptNode;

		var distortion = me.distortion = context.createWaveShaper();
		var audioAnalyser = me.audioAnalyser = context.createAnalyser();
		var gainNode = me.gainNode = context.createGain();
		gainNode.gain.value = 1;
		var biquadFilter = me.biquadFilter = context.createBiquadFilter();
		var convolver = me.convolver = context.createConvolver();

		var recorder = this.recorder = createScript.apply(context, [4096, 1, 1]);

		this.buffer = []; //录音缓存
		this.size = 0; //录音文件长度
		this.inputSampleRate = context.sampleRate; //输入采样率
		this.inputSampleBits = 16; //输入采样数位 8, 16
		this.outputSampleRate = me.config.sampleRate; //输出采样率
		this.oututSampleBits = me.config.sampleBits; //输出采样数位 8, 16

		this.audioData = {
			input: function (data) {
				me.buffer.push(new Float32Array(data));
				me.size += data.length;
			},
			compress: function () { //合并压缩
				//合并
				var data = new Float32Array(me.size);
				var offset = 0;
				for (var i = 0; i < me.buffer.length; i++) {
					data.set(me.buffer[i], offset);
					offset += me.buffer[i].length;
				}
				//压缩
				var compression = parseInt(me.inputSampleRate / me.outputSampleRate);
				var length = data.length / compression;
				var result = new Float32Array(length);
				var index = 0,
					j = 0;
				while (index < length) {
					result[index] = data[j];
					j += compression;
					index++;
				}
				return result;
			},
			encodeWAV: function () {
				var sampleRate = Math.min(me.inputSampleRate, me.outputSampleRate);
				var sampleBits = Math.min(me.inputSampleBits, me.oututSampleBits);
				var bytes = this.compress();
				var dataLength = bytes.length * (sampleBits / 8);
				var buffer = new ArrayBuffer(44 + dataLength);
				var data = new DataView(buffer);

				var channelCount = 1; //单声道
				var offset = 0;

				var writeString = function (str) {
					for (var i = 0; i < str.length; i++) {
						data.setUint8(offset + i, str.charCodeAt(i));
					}
				}

				// 资源交换文件标识符 
				writeString('RIFF');
				offset += 4;
				// 下个地址开始到文件尾总字节数,即文件大小-8 
				data.setUint32(offset, 36 + dataLength, true);
				offset += 4;
				// WAV文件标志
				writeString('WAVE');
				offset += 4;
				// 波形格式标志 
				writeString('fmt ');
				offset += 4;
				// 过滤字节,一般为 0x10 = 16 
				data.setUint32(offset, 16, true);
				offset += 4;
				// 格式类别 (PCM形式采样数据) 
				data.setUint16(offset, 1, true);
				offset += 2;
				// 通道数 
				data.setUint16(offset, channelCount, true);
				offset += 2;
				// 采样率,每秒样本数,表示每个通道的播放速度 
				data.setUint32(offset, sampleRate, true);
				offset += 4;
				// 波形数据传输率 (每秒平均字节数) 单声道×每秒数据位数×每样本数据位/8 
				data.setUint32(offset, channelCount * sampleRate * (sampleBits / 8), true);
				offset += 4;
				// 快数据调整数 采样一次占用字节数 单声道×每样本的数据位数/8 
				data.setUint16(offset, channelCount * (sampleBits / 8), true);
				offset += 2;
				// 每样本数据位数 
				data.setUint16(offset, sampleBits, true);
				offset += 2;
				// 数据标识符 
				writeString('data');
				offset += 4;
				// 采样数据总数,即数据总大小-44 
				data.setUint32(offset, dataLength, true);
				offset += 4;
				// 写入采样数据 
				if (sampleBits === 8) {
					for (var i = 0; i < bytes.length; i++, offset++) {
						var s = Math.max(-1, Math.min(1, bytes[i]));
						var val = s < 0 ? s * 0x8000 : s * 0x7FFF;
						val = parseInt(255 / (65535 / (val + 32768)));
						data.setInt8(offset, val, true);
					}
				} else {
					for (var i = 0; i < bytes.length; i++, offset += 2) {
						var s = Math.max(-1, Math.min(1, bytes[i]));
						data.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
					}
				}

				return new Blob([data], {
					type: 'audio/wav'
				});
			}
		};

		//音频采集
		recorder.onaudioprocess = function (e) {
			me.audioData.input(e.inputBuffer.getChannelData(0));
			//record(e.inputBuffer.getChannelData(0));
		};

		source.connect(audioAnalyser);
		audioAnalyser.connect(distortion);
		distortion.connect(biquadFilter);
		biquadFilter.connect(convolver);
		convolver.connect(gainNode);
		gainNode.connect(context.destination);

		source.connect(recorder);
		recorder.connect(context.destination);

		var ctx = me.renderCanvas.getContext('2d');
		var width = me.renderCanvas.width;
		var height = me.renderCanvas.height;

		// me.sound.src = (window.URL && window.URL.createObjectURL(me.stream));
		// me.sound.play();

		me.state = 'play';
		drawWave();

		function drawWave() {
			if (me.state == 'stop') {
				return;
			}
			audioAnalyser.fftSize = 2048;
			var bufferLength = audioAnalyser.frequencyBinCount;
			var dataArray = new Uint8Array(bufferLength);

			audioAnalyser.getByteTimeDomainData(dataArray);

			ctx.clearRect(0, 0, width, height);
			ctx.strokeStyle = 'rgb(255, 0, 0)';
			ctx.fillStyle = "#f5f5f5";
			ctx.fillRect(0, 0, width, height);
			ctx.lineWidth = 4;
			ctx.beginPath();

			var sliceWidth = width * 1.0 / bufferLength;
			var x = 0;

			for (var i = 0; i < bufferLength; i++) {
				var v = dataArray[i] / 128.0;
				var y = v * height / 2;

				if (i === 0) {
					ctx.moveTo(x, y);
				} else {
					ctx.lineTo(x, y);
				}
				x += sliceWidth;
			}

			ctx.lineTo(width, height / 2);
			ctx.stroke();

			requestAnimationFrame(drawWave)
		}
	};

	Recorder.prototype.start = function (canvas, audio) {
		var me = this;
		me.renderCanvas = canvas;
		me.sound = audio;

		if (me.stream) {
			me.init();
			return;
		}

		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
			navigator.mozGetUserMedia || navigator.msGetUserMedia;
		if (navigator.getUserMedia) {
			navigator.getUserMedia({
					audio: true //只启用音频
				},
				function (stream) {
					me.stream = stream;
					me.init();
				},
				function (error) {
					switch (error.code || error.name) {
						case 'PERMISSION_DENIED':
						case 'PermissionDeniedError':
							console.error('用户拒绝提供信息。');
							break;
						case 'NOT_SUPPORTED_ERROR':
						case 'NotSupportedError':
							console.error('浏览器不支持硬件设备。');
							break;
						case 'MANDATORY_UNSATISFIED_ERROR':
						case 'MandatoryUnsatisfiedError':
							console.error('无法发现指定的硬件设备。');
							break;
						default:
							console.error('无法打开麦克风。异常信息:' + (error.code || error.name));
							break;
					}
				}
			);
		} else {
			console.error('当前浏览器不支持录音功能。');
			return;
		}
	};

	Recorder.prototype.stop = function () {
		this.state = 'stop';
		this.recorder.disconnect();
		this.gainNode.disconnect();
		this.stream.stop();
		this.stream = null;
	};

	Recorder.prototype.getBlob = function () {
		return this.audioData.encodeWAV();
	};

	Recorder.prototype.play = function (audio) {
		audio.src = window.URL.createObjectURL(this.getBlob());
	};

	Recorder.prototype.upload = function () {

	};

	window.Recorder = Recorder;

})();