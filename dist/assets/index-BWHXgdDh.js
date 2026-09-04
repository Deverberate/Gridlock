(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();function e(e){let t=e.getContext(`webgl2`,{antialias:!1,alpha:!1,premultipliedAlpha:!1});if(!t)throw Error(`WebGL 2 not supported`);return t.enable(t.BLEND),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA),t.clearColor(.05,.05,.08,1),t}function t(e){return r(e,`#version 300 es
    precision highp float;

    // Per-vertex
    in vec2 a_quad;
    in vec2 a_uv;

    // Per-instance
    in vec2 a_position;
    in float a_spriteIdx;
    in float a_variant;
    in float a_zOrder;

    uniform mat4 u_projection;
    uniform float u_tileSize;
    uniform float u_atlasCols;
    uniform float u_spriteSize;

    out vec2 v_uv;
    out float v_spriteIdx;

    void main() {
      // Calculate UV within the atlas
      float col = mod(a_spriteIdx, u_atlasCols);
      float row = floor(a_spriteIdx / u_atlasCols);
      vec2 atlasUV = vec2(col, row) * u_spriteSize + a_uv * u_spriteSize;
      v_uv = atlasUV;
      v_spriteIdx = a_spriteIdx;

      // World position + quad offset
      vec2 worldPos = a_position * u_tileSize + a_quad * u_tileSize * 0.5;
      gl_Position = u_projection * vec4(worldPos, 0.0, 1.0);
    }
  `,`#version 300 es
    precision highp float;

    in vec2 v_uv;
    in float v_spriteIdx;

    uniform sampler2D u_atlas;

    out vec4 fragColor;

    void main() {
      vec4 color = texture(u_atlas, v_uv);
      if (color.a < 0.01) discard;
      fragColor = color;
    }
  `)}function n(e){return r(e,`#version 300 es
    precision highp float;

    in vec2 a_position;  // tile position
    in float a_tileType; // tile type for color lookup

    uniform mat4 u_projection;
    uniform float u_tileSize;

    out float v_tileType;
    out vec2 v_localUV;

    void main() {
      v_tileType = a_tileType;
      v_localUV = fract(a_position);

      vec2 worldPos = floor(a_position) * u_tileSize + fract(a_position) * u_tileSize;
      gl_Position = u_projection * vec4(worldPos, 0.0, 1.0);
    }
  `,`#version 300 es
    precision highp float;

    in float v_tileType;
    in vec2 v_localUV;

    out vec4 fragColor;

    void main() {
      // Simple color per tile type
      vec3 grass = vec3(0.18, 0.35, 0.12);
      vec3 water = vec3(0.1, 0.2, 0.55);
      vec3 stone = vec3(0.4, 0.38, 0.35);

      vec3 color;
      if (v_tileType < 0.5) {
        color = grass;
      } else if (v_tileType < 1.5) {
        color = water;
      } else {
        color = stone;
      }

      // Grid lines
      vec2 grid = smoothstep(0.02, 0.04, v_localUV) * (1.0 - smoothstep(0.96, 0.98, v_localUV));
      float gridFactor = grid.x * grid.y;
      color *= 0.85 + 0.15 * gridFactor;

      fragColor = vec4(color, 1.0);
    }
  `)}function r(e,t,n){let r=i(e,e.VERTEX_SHADER,t),a=i(e,e.FRAGMENT_SHADER,n),o=e.createProgram();if(e.attachShader(o,r),e.attachShader(o,a),e.linkProgram(o),!e.getProgramParameter(o,e.LINK_STATUS)){let t=e.getProgramInfoLog(o);throw e.deleteProgram(o),Error(`Shader link failed: `+t)}return o}function i(e,t,n){let r=e.createShader(t);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(r);throw e.deleteShader(r),Error(`Shader compile failed: `+t)}return r}var a=1e5,o=16,s=16,c=16;function l(){let e=new OffscreenCanvas(256,256),t=e.getContext(`2d`);t.clearRect(0,0,256,256);function n(e){let n=e%s,r=Math.floor(e/s);return t.save(),t.translate(n*o,r*o),t}{let e=n(0);e.fillStyle=`#2d5a1e`,e.fillRect(0,0,16,16),e.fillStyle=`#3a7a28`;for(let t=0;t<6;t++){let n=2+t*13%14,r=3+t*7%10;e.fillRect(n,r,1,3)}t.restore()}{let e=n(1);e.fillStyle=`#1a3d7a`,e.fillRect(0,0,16,16),e.fillStyle=`#2a5daa`;for(let t=0;t<3;t++){let n=3+t*5;e.fillRect(1,n,14,1),e.fillRect(3,n-1,2,1)}t.restore()}{let e=n(2);e.fillStyle=`#665e58`,e.fillRect(0,0,16,16),e.fillStyle=`#8a7e75`,e.fillRect(3,3,5,4),e.fillRect(9,8,4,5),e.fillStyle=`#554e48`,e.fillRect(1,10,3,3),t.restore()}{let e=n(3);e.fillStyle=`#2d5a1e`,e.fillRect(0,0,16,16),e.fillStyle=`#888`,e.fillRect(4,3,8,10),e.fillStyle=`#aa6633`,e.fillRect(6,5,4,4),e.fillStyle=`#ccc`,e.fillRect(7,9,2,3),t.restore()}{let e=n(4);e.fillStyle=`#2d5a1e`,e.fillRect(0,0,16,16),e.fillStyle=`#774422`,e.fillRect(3,4,10,8),e.fillStyle=`#cc4400`,e.fillRect(5,6,6,4),e.fillStyle=`#ff8800`,e.fillRect(6,7,4,2),t.restore()}{let e=n(5);e.fillStyle=`#2d5a1e`,e.fillRect(0,0,16,16),e.fillStyle=`#555`,e.fillRect(2,3,12,10),e.fillStyle=`#4488cc`,e.fillRect(4,5,8,6),e.fillStyle=`#66aaff`,e.fillRect(6,7,4,2),t.restore()}{let e=n(6);e.fillStyle=`#2d5a1e`,e.fillRect(0,0,16,16),e.fillStyle=`#666`,e.fillRect(3,2,10,12),e.fillStyle=`#44aa44`,e.fillRect(5,4,6,3),e.fillStyle=`#aaa`,e.fillRect(6,8,4,4),t.restore()}{let e=n(7);e.fillStyle=`#2d5a1e`,e.fillRect(0,0,16,16),e.fillStyle=`#556`,e.fillRect(0,5,16,6),e.fillStyle=`#889`;for(let t=0;t<4;t++)e.fillRect(1+t*4,7,2,2);e.fillStyle=`#aabbcc`,e.fillRect(3,8,1,1),e.fillRect(7,8,1,1),e.fillRect(11,8,1,1),t.restore()}{let e=n(8);e.fillStyle=`#2d5a1e`,e.fillRect(0,0,16,16),e.fillStyle=`#556`,e.fillRect(5,0,6,16),e.fillStyle=`#889`;for(let t=0;t<4;t++)e.fillRect(7,1+t*4,2,2);t.restore()}{let e=n(9);e.fillStyle=`#2d5a1e`,e.fillRect(0,0,16,16),e.fillStyle=`#556`,e.fillRect(0,5,16,6),e.fillRect(8,5,6,6),t.restore()}{let e=n(10);e.fillStyle=`#2d5a1e`,e.fillRect(0,0,16,16),e.fillStyle=`#556`,e.fillRect(5,0,6,16),e.fillRect(5,8,6,6),t.restore()}{let e=n(11);e.fillStyle=`#2d5a1e`,e.fillRect(0,0,16,16),e.fillStyle=`#886633`,e.fillRect(7,2,2,12),e.fillStyle=`#ccaa44`,e.fillRect(5,2,6,2),e.fillRect(5,5,6,2),t.restore()}{let e=n(12);e.fillStyle=`#8899aa`,e.fillRect(4,4,8,8),e.fillStyle=`#aabbcc`,e.fillRect(5,5,3,3),e.fillRect(9,7,2,2),t.restore()}{let e=n(13);e.fillStyle=`#886633`,e.fillRect(4,4,8,8),e.fillStyle=`#cc8844`,e.fillRect(5,5,3,3),e.fillRect(8,8,3,2),t.restore()}{let e=n(14);e.fillStyle=`#999`,e.fillRect(5,5,6,6),e.fillStyle=`#bbb`,e.fillRect(6,6,4,4),e.fillStyle=`#777`,e.fillRect(7,7,2,2),e.fillStyle=`#999`,e.fillRect(7,3,2,2),e.fillRect(7,11,2,2),e.fillRect(3,7,2,2),e.fillRect(11,7,2,2),t.restore()}{let e=n(15);e.fillStyle=`#aabbcc`,e.fillRect(3,6,10,5),e.fillStyle=`#ccddee`,e.fillRect(4,7,8,3),t.restore()}return{canvas:e,width:256,height:256,spriteSize:o,atlasCols:s,atlasRows:c,spriteCount:256}}var u=1e5,d=class{constructor(e){this.gl=e,this.program=t(e),this.atlas=null,this.atlasTexture=null,this.quadVerts=new Float32Array([-1,-1,0,1,1,-1,1,1,1,1,1,0,-1,-1,0,1,1,1,1,0,-1,1,0,0]),this.instanceData=new Float32Array(u*6),this.instanceCount=0,this._initBuffers(e),this._initAtlas(e),this._initUniforms(e)}_initBuffers(e){this.vao=e.createVertexArray(),e.bindVertexArray(this.vao),this.quadVBO=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.quadVBO),e.bufferData(e.ARRAY_BUFFER,this.quadVerts,e.STATIC_DRAW);let t=e.getAttribLocation(this.program,`a_quad`);e.enableVertexAttribArray(t),e.vertexAttribPointer(t,2,e.FLOAT,!1,16,0);let n=e.getAttribLocation(this.program,`a_uv`);e.enableVertexAttribArray(n),e.vertexAttribPointer(n,2,e.FLOAT,!1,16,8),this.instanceVBO=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.instanceVBO),e.bufferData(e.ARRAY_BUFFER,this.instanceData.byteLength,e.DYNAMIC_DRAW);let r=e.getAttribLocation(this.program,`a_position`);e.enableVertexAttribArray(r),e.vertexAttribPointer(r,2,e.FLOAT,!1,24,0),e.vertexAttribDivisor(r,1);let i=e.getAttribLocation(this.program,`a_spriteIdx`);e.enableVertexAttribArray(i),e.vertexAttribPointer(i,1,e.FLOAT,!1,24,8),e.vertexAttribDivisor(i,1);let a=e.getAttribLocation(this.program,`a_variant`);e.enableVertexAttribArray(a),e.vertexAttribPointer(a,1,e.FLOAT,!1,24,12),e.vertexAttribDivisor(a,1);let o=e.getAttribLocation(this.program,`a_zOrder`);e.enableVertexAttribArray(o),e.vertexAttribPointer(o,1,e.FLOAT,!1,24,16),e.vertexAttribDivisor(o,1),e.bindVertexArray(null)}_initAtlas(e){let t=l();this.atlas=t,this.atlasTexture=e.createTexture(),e.bindTexture(e.TEXTURE_2D,this.atlasTexture),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,t.canvas),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}_initUniforms(e){e.useProgram(this.program),this.uProjection=e.getUniformLocation(this.program,`u_projection`),this.uTileSize=e.getUniformLocation(this.program,`u_tileSize`),this.uAtlasCols=e.getUniformLocation(this.program,`u_atlasCols`),this.uSpriteSize=e.getUniformLocation(this.program,`u_spriteSize`),this.uAtlas=e.getUniformLocation(this.program,`u_atlas`),e.useProgram(null)}updateFromSharedBuffer(e,t,n){new Float32Array(e.buffer);let r=Math.min(n,u);this.instanceCount=r;let i=t*4,a=this.instanceData,o=new Float32Array(e.buffer,i,r*6);a.set(o.subarray(0,r*6))}render(e){let{gl:t,program:n}=this;this.instanceCount!==0&&(t.useProgram(n),t.uniformMatrix4fv(this.uProjection,!1,e),t.uniform1f(this.uTileSize,16),t.uniform1f(this.uAtlasCols,this.atlas.atlasCols),t.uniform1f(this.uSpriteSize,1/this.atlas.atlasRows),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,this.atlasTexture),t.uniform1i(this.uAtlas,0),t.bindBuffer(t.ARRAY_BUFFER,this.instanceVBO),t.bufferSubData(t.ARRAY_BUFFER,0,this.instanceData.subarray(0,this.instanceCount*6)),t.bindVertexArray(this.vao),t.drawArraysInstanced(t.TRIANGLES,0,6,this.instanceCount),t.bindVertexArray(null),t.useProgram(null))}},f=class{constructor(e){this.gl=e,this.program=n(e),this.meshes=new Map,e.useProgram(this.program),this.uProjection=e.getUniformLocation(this.program,`u_projection`),this.uTileSize=e.getUniformLocation(this.program,`u_tileSize`),e.useProgram(null)}buildChunkMesh(e,t,n){let r=`${e},${t}`,i=this.gl,a=new Float32Array(18432),o=0,s=e*32,c=t*32;for(let e=0;e<32;e++)for(let t=0;t<32;t++){let r=n.tiles[e*32+t],i=s+t,l=c+e;a[o++]=i,a[o++]=l,a[o++]=r,a[o++]=i+1,a[o++]=l,a[o++]=r,a[o++]=i+1,a[o++]=l+1,a[o++]=r,a[o++]=i,a[o++]=l,a[o++]=r,a[o++]=i+1,a[o++]=l+1,a[o++]=r,a[o++]=i,a[o++]=l+1,a[o++]=r}let l=this.meshes.get(r);if(l||(l={vao:i.createVertexArray(),vbo:i.createBuffer(),vertexCount:0,dirty:!0},this.meshes.set(r,l)),i.bindVertexArray(l.vao),!l._vboInit){i.bindBuffer(i.ARRAY_BUFFER,l.vbo);let e=i.getAttribLocation(this.program,`a_position`);i.enableVertexAttribArray(e),i.vertexAttribPointer(e,2,i.FLOAT,!1,12,0);let t=i.getAttribLocation(this.program,`a_tileType`);i.enableVertexAttribArray(t),i.vertexAttribPointer(t,1,i.FLOAT,!1,12,8),l._vboInit=!0}return i.bindBuffer(i.ARRAY_BUFFER,l.vbo),i.bufferData(i.ARRAY_BUFFER,a,i.DYNAMIC_DRAW),l.vertexCount=o/3,l.dirty=!1,i.bindVertexArray(null),l.vertexCount}render(e){let{gl:t,program:n}=this;t.useProgram(n),t.uniformMatrix4fv(this.uProjection,!1,e),t.uniform1f(this.uTileSize,16);for(let[e,n]of this.meshes)n.vertexCount!==0&&(t.bindVertexArray(n.vao),t.drawArrays(t.TRIANGLES,0,n.vertexCount));t.bindVertexArray(null),t.useProgram(null)}removeMesh(e,t){let n=`${e},${t}`,r=this.meshes.get(n);r&&(this.gl.deleteVertexArray(r.vao),this.gl.deleteBuffer(r.vbo),this.meshes.delete(n))}},p=class{constructor(e,t){this.x=0,this.y=0,this.zoom=2,this.width=e,this.height=t}resize(e,t){this.width=e,this.height=t}pan(e,t){let n=16*this.zoom;this.x-=e/n,this.y-=t/n}zoomAt(e,t,n){let r=this.zoom;this.zoom=Math.max(.25,Math.min(8,this.zoom*n));let i=16*this.zoom,a=16*r,o=this.x+(e-this.width/2)/a,s=this.y+(t-this.height/2)/a,c=this.x+(e-this.width/2)/i,l=this.y+(t-this.height/2)/i;this.x+=o-c,this.y+=s-l}get scale(){return 16*this.zoom}getProjection(){let e=this.scale,t=this.width/2,n=this.height/2,r=this.x*e-t,i=this.x*e+t,a=this.y*e+n,o=this.y*e-n;return new Float32Array([2/(i-r),0,0,0,0,2/(o-a),0,0,0,0,-1,0,-(i+r)/(i-r),-(o+a)/(o-a),0,1])}screenToWorld(e,t){let n=this.scale;return[this.x+(e-this.width/2)/n,this.y+(t-this.height/2)/n]}},m=2+a*6,h=2+m*2,g=class{constructor(){this.buffer=new SharedArrayBuffer(h*4),this.view=new Int32Array(this.buffer),this.fView=new Float32Array(this.buffer),this.OFF_FLAG=0,this.OFF_COUNT=1,this.OFF_A_DATA=2,this.OFF_B_DATA=2+m,Atomics.store(this.view,this.OFF_FLAG,0),Atomics.store(this.view,this.OFF_COUNT,0)}getWriteOffset(){return Atomics.load(this.view,this.OFF_FLAG)===0?this.OFF_B_DATA:this.OFF_A_DATA}getReadOffset(){return Atomics.load(this.view,this.OFF_FLAG)===0?this.OFF_A_DATA:this.OFF_B_DATA}swap(e){Atomics.store(this.view,this.OFF_COUNT,e);let t=Atomics.load(this.view,this.OFF_FLAG);Atomics.store(this.view,this.OFF_FLAG,+(t===0))}getCount(){return Atomics.load(this.view,this.OFF_COUNT)}getBuffer(){return this.buffer}},_=class{constructor(){this.keys=new Set,this.justPressed=new Set,window.addEventListener(`keydown`,e=>{this.keys.has(e.code)||this.justPressed.add(e.code),this.keys.add(e.code)}),window.addEventListener(`keyup`,e=>{this.keys.delete(e.code)})}isDown(e){return this.keys.has(e)}wasPressed(e){return this.justPressed.has(e)}flush(){this.justPressed.clear()}getMovementDir(){let e=0,t=0;if((this.isDown(`KeyW`)||this.isDown(`ArrowUp`))&&--t,(this.isDown(`KeyS`)||this.isDown(`ArrowDown`))&&(t+=1),(this.isDown(`KeyA`)||this.isDown(`ArrowLeft`))&&--e,(this.isDown(`KeyD`)||this.isDown(`ArrowRight`))&&(e+=1),e!==0&&t!==0){let n=1/Math.SQRT2;e*=n,t*=n}return{dx:e,dy:t}}},v=class{constructor(e){this.canvas=e,this.x=0,this.y=0,this.buttons=0,this.wheelDelta=0,this._panStart=null,this._isPanning=!1,e.addEventListener(`mousemove`,t=>{let n=e.getBoundingClientRect();this.x=t.clientX-n.left,this.y=t.clientY-n.top,this._isPanning&&this._panStart&&(this._panDeltaX=this.x-this._panStart.x,this._panDeltaY=this.y-this._panStart.y,this._panStart={x:this.x,y:this.y})}),e.addEventListener(`mousedown`,e=>{this.buttons|=1<<e.button,(e.button===1||e.button===2)&&(this._isPanning=!0,this._panStart={x:this.x,y:this.y},this._panDeltaX=0,this._panDeltaY=0,e.preventDefault())}),e.addEventListener(`mouseup`,e=>{this.buttons&=~(1<<e.button),(e.button===1||e.button===2)&&this._isPanning&&(this._isPanning=!1,this._panStart=null)}),e.addEventListener(`wheel`,e=>{this.wheelDelta+=e.deltaY>0?-1:1,e.preventDefault()},{passive:!1}),e.addEventListener(`contextmenu`,e=>e.preventDefault()),this._panDeltaX=0,this._panDeltaY=0}isDown(e){return!!(this.buttons&1<<e)}isLeft(){return this.isDown(0)}isMiddle(){return this.isDown(1)}isRight(){return this.isDown(2)}getPanDelta(){let e=this._panDeltaX,t=this._panDeltaY;return this._panDeltaX=0,this._panDeltaY=0,{dx:e,dy:t}}consumeWheel(){let e=this.wheelDelta;return this.wheelDelta=0,e}},y=600,b=class{constructor(e,t,n){this.camera=e,this.keyboard=t,this.mouse=n}update(e){let{camera:t,keyboard:n,mouse:r}=this,i=n.getMovementDir();if(i.dx!==0||i.dy!==0){let n=i.dx*y*e,r=i.dy*y*e;t.pan(n,r)}if(r.isMiddle()||r.isRight()){let e=r.getPanDelta();(e.dx!==0||e.dy!==0)&&t.pan(e.dx,e.dy)}let a=r.consumeWheel();if(a!==0){let e=a>0?1.15:1/1.15;t.zoomAt(r.x,r.y,e)}}},x=document.getElementById(`game-canvas`),S=document.getElementById(`hud`),C=document.getElementById(`tooltip`);function w(){let e=window.devicePixelRatio||1;x.width=window.innerWidth*e,x.height=window.innerHeight*e,x.style.width=window.innerWidth+`px`,x.style.height=window.innerHeight+`px`}w(),window.addEventListener(`resize`,()=>{w(),A.resize(x.width,x.height),D.viewport(0,0,x.width,x.height)});var T=new g,E=2+a*6,D=e(x);D.viewport(0,0,x.width,x.height);var O=new d(D),k=new f(D),A=new p(x.width,x.height),j=new _,M=new v(x),N=new b(A,j,M),P=new Worker(new URL(`/assets/worker-Ccpoit7K.js`,``+import.meta.url),{type:`module`}),F=!1;P.onmessage=e=>{let t=e.data;switch(t.type){case`ready`:F=!0,console.log(`[Main] Worker ready — starting render loop`),requestAnimationFrame(U);break;case`stats`:t.entityCount}},P.postMessage({type:`init`,sharedBuffer:T.getBuffer(),sbLayout:{totalSizePerHalf:E,offB:2+E}});var I=`select`,L=document.querySelectorAll(`.tool-btn`);L.forEach(e=>{e.addEventListener(`click`,()=>{L.forEach(e=>e.classList.remove(`active`)),e.classList.add(`active`),I=e.dataset.tool})});var R=0,z=0,B=performance.now(),V=0,H=0;function U(e){if(!F)return;let t=performance.now();N.update(1/60);for(let e=1;e<=4;e++)j.wasPressed(`Digit`+e)&&(R=R===e?0:e);j.wasPressed(`Digit0`)&&(R=0);let n=T.getReadOffset(),r=T.getCount(),i=new Int32Array(T.getBuffer());O.updateFromSharedBuffer(i,n,r);let a=performance.now();D.clear(D.COLOR_BUFFER_BIT);let o=A.getProjection();k.render(o),O.render(o),H=performance.now()-a,z++,e-B>=1e3&&(V=z,z=0,B=e),S.innerHTML=`<b>Factory Sim — Phase 1</b><br>FPS: ${V}<br>Entities: ${r.toLocaleString()}<br>Render: ${H.toFixed(1)}ms<br>Zoom: ${A.zoom.toFixed(2)}x<br>Camera: (${A.x.toFixed(1)}, ${A.y.toFixed(1)})<br>Tool: ${I}<br>`+(R>0?`Overlay: ${[``,`Power`,`Pollution`,`Logistics`,`Production`][R]}<br>`:``),W(e),j.flush(),H=performance.now()-t,requestAnimationFrame(U)}function W(e){let[t,n]=A.screenToWorld(M.x,M.y),r=Math.floor(t),i=Math.floor(n);M.x>0&&M.y>0?(C.style.display=`block`,C.style.left=M.x+16+`px`,C.style.top=M.y+16+`px`,C.textContent=`Tile: (${r}, ${i})\nWorld: (${t.toFixed(2)}, ${n.toFixed(2)})`):C.style.display=`none`}console.log(`[Main] Initializing Factory Sim...`),console.log(`[Main] SharedArrayBuffer:`,typeof SharedArrayBuffer<`u`?`OK`:`UNAVAILABLE`);