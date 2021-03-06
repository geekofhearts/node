// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var events = require('events');
var util = require('util');

function Stream() {
  events.EventEmitter.call(this);
}
util.inherits(Stream, events.EventEmitter);
exports.Stream = Stream;

var pipes = [];

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  pipes.push(dest);

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk)) source.pause();
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable) source.resume();
  }

  dest.on('drain', ondrain);

  /*
   * If the 'end' option is not supplied, dest.end() will be called when
   * source gets the 'end' event.
   */

  if (!options || options.end !== false) {
    function onend() {
      var index = pipes.indexOf(dest);
      pipes.splice(index, 1);

      if (pipes.indexOf(dest) > -1) {
        return;
      }

      dest.end();
    }

    source.on('end', onend);
    source.on('close', onend);
  }

  /*
   * Questionable:
   */

  if (!source.pause) {
    source.pause = function() {
      source.emit('pause');
    };
  }

  if (!source.resume) {
    source.resume = function() {
      source.emit('resume');
    };
  }

  var onpause = function() {
    source.pause();
  }

  dest.on('pause', onpause);

  var onresume = function() {
    if (source.readable) source.resume();
  };

  dest.on('resume', onresume);

  var cleanup = function () {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);
    source.removeListener('end', onend);
    source.removeListener('close', onend);

    dest.removeListener('pause', onpause);
    dest.removeListener('resume', onresume);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('end', cleanup);
    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('end', cleanup);
  dest.on('close', cleanup);

  dest.emit('pipe', source);
};
