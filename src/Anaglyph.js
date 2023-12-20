import * as THREE from "three";

const fragShader = `
  precision highp float;

  uniform sampler2D image;  // video texture
  uniform vec2 imageSize;   // x for width, y for height
  uniform int method;       // selected anaglyph

  out vec4 out_FragColor;   // output color

  // Source for matrices: https://3dtv.at/Knowhow/AnaglyphComparison_en.aspx

  vec4 applyTrue(vec3 rgb1, vec3 rgb2){
    mat3 left = mat3(0.299, 0, 0, 0.587, 0, 0, 0.114, 0, 0);
    mat3 right = mat3(0, 0, 0.299, 0, 0, 0.587, 0, 0, 0.114);
    vec3 result = left*rgb1 + right*rgb2;
    return vec4(result, 1.);
  }

  vec4 applyGray(vec3 rgb1, vec3 rgb2){
    mat3 left = mat3(0.299, 0, 0, 0.587, 0, 0, 0.114, 0, 0);
    mat3 right = mat3(0, 0.299, 0.299, 0, 0.587, 0.587, 0, 0.114, 0.114);
    vec3 result = left*rgb1 + right*rgb2;
    return vec4(result, 1.);
  }

  vec4 applyColor(vec3 rgb1, vec3 rgb2){
    mat3 left = mat3(1., 0, 0, 0, 0, 0, 0, 0, 0);
    mat3 right = mat3(0, 0, 0, 0, 1., 0, 0, 0, 1.);
    vec3 result = left*rgb1 + right*rgb2;
    return vec4(result, 1.);
  }

  vec4 applyHalfColor(vec3 rgb1, vec3 rgb2){
    mat3 left = mat3(0.299, 0, 0, 0.587, 0, 0, 0.114, 0, 0);
    mat3 right = mat3(0, 0, 0, 0, 1., 0, 0, 0, 1.);
    vec3 result = left*rgb1 + right*rgb2;
    return vec4(result, 1.);
  }

  vec4 applyOptimized(vec3 rgb1, vec3 rgb2){
    mat3 left = mat3(0, 0, 0, 0.7, 0, 0, 0.3, 0, 0);
    mat3 right = mat3(0, 0, 0, 0, 1., 0, 0, 0, 1.);
    vec3 result = left*rgb1 + right*rgb2;
    return vec4(result, 1.);
  }


  void main() {
    float imageWidth = imageSize.x;
    float imageHeight = imageSize.y;

    // Get the RGB value assuming the stereo image is divided halfway through the x axis
    vec3 rgb1 = texelFetch(image, ivec2(gl_FragCoord.x/2., gl_FragCoord.y), 0).rgb;  // Left
    vec3 rgb2 = texelFetch(image, ivec2(gl_FragCoord.x/2. + imageWidth/2.0, gl_FragCoord.y), 0).rgb;  // Right
    
    // Apply the selected anaglyph. Default case is no anaglyph.
    switch(method) {
      case 0: out_FragColor = applyTrue(rgb1, rgb2);
              break;
      case 1: out_FragColor = applyGray(rgb1, rgb2);
              break;
      case 2: out_FragColor = applyColor(rgb1, rgb2);
              break;
      case 3: out_FragColor = applyHalfColor(rgb1, rgb2);
              break;
      case 4: out_FragColor = applyOptimized(rgb1, rgb2);
              break;
      default: out_FragColor = texelFetch(image, ivec2(gl_FragCoord.x, gl_FragCoord.y), 0);
    }
  }
`;

const vtxShader = `
    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;

    precision highp float;

    in vec3 position;

    void main() {
        gl_Position = projectionMatrix *
                    modelViewMatrix * 
                    vec4(position, 1.0);
    }
`;

export class Anaglyph {
  constructor(video, canvas, method) {
    this.image = video;
    this.ipMaterial = new THREE.RawShaderMaterial({
      uniforms: {
        image: { type: "t", value: this.image },
        imageSize: { type: "vec2", value: [this.image.image.width, this.image.image.height] },
        method: { type: "i", value: method },
      },
      vertexShader: vtxShader,
      fragmentShader: fragShader,
      glslVersion: THREE.GLSL3,
    });

    this.canvas = canvas;
    this.context = canvas.getContext("webgl2");

    this.IVimageProcessing();
  }

  processVideo(video) {
    var videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.NearestFilter;
    videoTexture.magFilter = THREE.NearestFilter;
    videoTexture.generateMipmaps = false;
    videoTexture.format = THREE.RGBAFormat;
    return videoTexture;
  }

  IVimageProcessing() {
    //3 rtt setup
    this.scene = new THREE.Scene();
    this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1 / Math.pow(2, 53), 1);

    //4 create a target texture
    var options = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      canvas: this.canvas,
      context: this.context,
    };
    this.rtt = new THREE.WebGLRenderTarget(this.image.image.width, this.image.image.height, options);

    var geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0]), 3)
    );

    this.ipMesh = new THREE.Mesh(geom, this.ipMaterial);
    this.ipMesh.name = "ipMesh";

    this.scene.add(this.ipMesh);
  }

  IVprocess(renderer) {
    // Off-screen rendering
    renderer.setRenderTarget(this.rtt);
    renderer.render(this.scene, this.orthoCamera);
    renderer.setRenderTarget(null);
  }

  set method(value) {
    this.ipMesh.material.uniforms.method.value = value;
  }
}
