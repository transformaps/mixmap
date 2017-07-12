var mixmap = require('../')(require('regl'), {
  extensions: ['oes_element_index_uint']
})
var map = mixmap.create()
var glsl = require('glslify')
var xhr = require('xhr')

var levels = { 0: 0, 1: 3, 2: 5 }
Object.keys(levels).forEach(function (level) {
  var zmin = levels[level]
  xhr(level + '/meta.json', function (err, res, body) {
    var viewboxes = JSON.parse(body)
    map.addLayer('countries-'+level, {
      viewbox: function (bbox, zoom, cb) {
        console.log('zoom=',zoom)
        if (zmin <= zoom) cb(null, viewboxes)
        else cb(null, [])
      },
      add: function (key) {
        console.log('ADD',level,key)
        xhr(level + '/' + key + '.json', function (err, res, body) {
          var data = JSON.parse(body)
          addTile(level+'/'+key, Number(level), data)
        })
      },
      remove: function (key) {
        console.log('REMOVE',level,key)
        map.remove(level+'/'+key)
      }
    })
  })
})

function addTile (key, zindex, data) {
  map.add(key, {
    frag: glsl`
      precision highp float;
      #pragma glslify: hsl2rgb = require('glsl-hsl2rgb')
      varying float vcolor;
      void main () {
        gl_FragColor = vec4(hsl2rgb(vcolor/5.0+0.55,0.6,0.8),1);
      }
    `,
    vert: `
      precision highp float;
      attribute vec2 position;
      attribute float color;
      varying float vcolor;
      uniform vec4 viewbox;
      uniform vec2 offset;
      uniform float zindex;
      void main () {
        vcolor = color;
        vec2 p = position + offset;
        gl_Position = vec4(
          (p.x - viewbox.x) / (viewbox.z - viewbox.x) * 2.0 - 1.0,
          (p.y - viewbox.y) / (viewbox.w - viewbox.y) * 2.0 - 1.0,
          1.0/(zindex+1.0), 1);
      }
    `,
    uniforms: {
      zindex: zindex
    },
    attributes: {
      position: data.triangle.positions,
      color: data.triangle.colors
    },
    elements: data.triangle.cells
  })
}

var app = require('choo')()
var html = require('choo/html')

app.use(function (state, emitter) {
  setSize()
  window.addEventListener('resize', function () {
    setSize()
    emitter.emit('render')
  })
  window.addEventListener('keydown', function (ev) {
    if (ev.code === 'Equal') {
      map.setZoom(map.getZoom()+1)
    } else if (ev.code === 'Minus') {
      map.setZoom(map.getZoom()-1)
    }
  })
  function setSize () {
    state.width = Math.min(window.innerWidth-50,600)
    state.height = Math.min(window.innerHeight-50,400)
  }
})

app.route('/cool', function (state, emit) {
  return html`<body>
    <a href="/">back</a>
  </body>`
})
app.route('*', function (state, emit) {
  return html`<body>
    ${mixmap.render()}
    <h1>mixmap</h1>
    <a href="/cool">cool</a>
    <div>
      <button onclick=${zoomIn}>zoom in</button>
      <button onclick=${zoomOut}>zoom out</button>
    </div>
    ${map.render(state)}
  </body>`
  function zoomIn () { map.setZoom(map.getZoom()+1) }
  function zoomOut () { map.setZoom(map.getZoom()-1) }
})
app.mount('body')
