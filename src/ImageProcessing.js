import * as THREE from "three";

const fragShader = `
  precision highp float;

  uniform sampler2D image;          // texture (either video or output from previous processing)
  uniform int imageWidth;           // texture width
  uniform int imageHeight;          // texture height
  uniform int kernelSize;           // size of the kernel
  uniform float sigma;              // standard deviation
  uniform float[9] conv_lp_kernel;  // Kernel for the laplacian filter
  uniform int method;               // The image processing method
  uniform bool isDoublePass;        // if true, only apply render for separable gaussian
  uniform float norm;               // LoG filter normalization factor

  out vec4 out_FragColor;           // output color

  #define PI 3.14159265359
  #define MAX_KERNEL_SIZE 5         // Maximum size of the kernel


  vec4 applyConvGaussian(int posX, int posY) {
    // Source: https://homepages.inf.ed.ac.uk/rbf/HIPR2/gsmooth.htm
    float sumWeights = 0.0;
    vec3 tmpColor;
    int kd2 = kernelSize/2;
    for (int x = -kd2; x <= kd2; x++) {
      for (int y = -kd2; y <= kd2; y++) {
        float a = 1.0 / (2.0 * PI * sigma * sigma);
        float b = exp(-(float(x*x + y*y)) / (2.0 * sigma * sigma));
        float weight = a * b;
        sumWeights += weight;
        tmpColor += texelFetch(image, ivec2(posX + x, posY + y), 0).rgb * weight;  // Get value of the pixel and multiply by the weight
      }
    }
    // Output the normalized color value
    vec3 gaussian = tmpColor/sumWeights;
    return vec4(gaussian, 1.);
  }

  vec4 applyConvLaplacian(int posX, int posY){
    // Source: https://homepages.inf.ed.ac.uk/rbf/HIPR2/log.htm
    vec3 laplacian = vec3(0);
    for (int i=-1; i<=1; i++) {
      for (int j=-1; j<=1; j++) {
        laplacian += texelFetch(image, ivec2(posX + i, posY + j), 0).rgb * conv_lp_kernel[(i+1)*3 + j+1];
      }
    }
    return vec4(laplacian, 1.);
  }

  vec4 applySeparableGaussian(int posX, int posY, bool isDoublePass) {
    // Source: https://homepages.inf.ed.ac.uk/rbf/HIPR2/gsmooth.htm
    float sumWeights = 0.0;
    vec3 tmpColor;
    int kd2 = kernelSize/2;
    for (int x = -kd2; x <= kd2; x++) {
      float a = 1.0 / (sqrt(2.0 * PI) * sigma );
      float b = exp(-float(x*x) / (2.0 * sigma * sigma));
      float weight = a * b;
      sumWeights += weight;
      if (isDoublePass == true) {
        // Vertical gaussian
        tmpColor += texelFetch(image, ivec2(posX, posY + x), 0).rgb * weight;  // Get value of the pixel and multiply by the weight  
      } else {
        // Horizontal gaussian
        tmpColor += texelFetch(image, ivec2(posX + x, posY), 0).rgb * weight;  // Get value of the pixel and multiply by the weight
      }
    }
    // Output the normalized color value
    vec3 gaussian = tmpColor/sumWeights;
    return vec4(gaussian, 1.);
  }

  float[MAX_KERNEL_SIZE*MAX_KERNEL_SIZE] insertionSort(float array[MAX_KERNEL_SIZE*MAX_KERNEL_SIZE]) {
    // Source: https://www.programiz.com/dsa/insertion-sort
    int size = MAX_KERNEL_SIZE*MAX_KERNEL_SIZE;
    for (int step = 1; step < size; step++) {
      float key = array[step];
      int j = step - 1;
  
      // Compare key with each element on the left of it until an element smaller than it is found.
      while (key < array[j] && j >= 0) {
        array[j + 1] = array[j];
        j = j - 1;
      }
      array[j + 1] = key;
    }
    return array;
  }

  vec4 applyDenoiseMedian(int posX, int posY) {
    float[MAX_KERNEL_SIZE*MAX_KERNEL_SIZE] r;
    float[MAX_KERNEL_SIZE*MAX_KERNEL_SIZE] g;
    float[MAX_KERNEL_SIZE*MAX_KERNEL_SIZE] b;
    int vecPos;
    int kSize;
    if (kernelSize > MAX_KERNEL_SIZE) {
      kSize = MAX_KERNEL_SIZE;
    } else {
      kSize = kernelSize;
    }
    int kd2 = kSize/2;
    vec3 tmpColor;
    for (int x = -kd2; x <= kd2; x++) {
      for (int y = -kd2; y <= kd2; y++) {
        tmpColor = texelFetch(image, ivec2(posX + x, posY + y), 0).rgb;
        vecPos = (x+kd2)*kSize + y+kd2;
        r[vecPos] = tmpColor.r;
        g[vecPos] = tmpColor.g;
        b[vecPos] = tmpColor.b;
      }
    }
    r = insertionSort(r);
    g = insertionSort(g);
    b = insertionSort(b);

    int medianPos = kSize*kSize/2;
    vec3 denoise = vec3(r[medianPos], g[medianPos], b[medianPos]);
    return vec4(denoise, 1.);
  }

  vec4 applyLoG(int posX, int posY, bool isDoublePass) {
    if (isDoublePass) {
      return applyConvLaplacian(posX, posY) * norm;
    } else {
      return applyConvGaussian(posX, posY);
    }
  }

  void main() {
    vec4 tmpColor = vec4(0.0);
    float weight = 1.0;
    float sumWeights = 0.0;

    int posX = int(gl_FragCoord.x);
    int posY = int(gl_FragCoord.y);

    int kd2 = kernelSize/2;

    /* NOTE ON BOUNDARY FIX
        The following two if cases fix the boundary border issue (without them, it
        appears dark). It works well for small values of kernel_size, but as it
        increases, it becomes noticeable the problem with this solution: the borders
        get a 'stretching' effect.

        A better approach for this would be an adaptive kernel window, in which the
        kernel size reduces as it approaches the border, making sure that the window
        is always full and not outside the boundary.
    */
    // Check if at the image boundary of x
    if (posX < kd2) {
      posX = kd2;
    } else if (posX > imageWidth - kd2) {
      posX = imageWidth - kd2 - 1;  // -1.0 fixes boundary error
    }

    // Check if at the image boundary of y
    if (posY < kd2) {
      posY = kd2;
    } else if (posY > imageHeight - kd2) {
      posY = imageHeight - kd2 - 1;  // -1.0 fixes boundary error
    }

    if (isDoublePass == true && method != 2 && method != 4) {
      /* 
        If this shader is applied to a double pass image processing object, then
        we skip applying image processing method and render the input as is, UNLESS
        the selected method is Separable Gaussian Filter. In that case, apply separable
        gaussian on the Y axis.
      */
      out_FragColor = texelFetch(image, ivec2(gl_FragCoord.x, gl_FragCoord.y), 0);
    } else {
      switch(method) {
        case 0: out_FragColor = applyConvGaussian(posX, posY);
                break;
        case 1: out_FragColor = applyConvLaplacian(posX, posY);
                break;
        case 2: out_FragColor = applySeparableGaussian(posX, posY, isDoublePass);
                break;
        case 3: out_FragColor = applyDenoiseMedian(posX, posY);
                break;
        case 4: out_FragColor = applyLoG(posX, posY, isDoublePass);
                break;
        default: out_FragColor = texelFetch(image, ivec2(gl_FragCoord.x, gl_FragCoord.y), 0);
      }
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

export class ImageProcessor {
  constructor(video, canvas, isDoublePass, method, kernelSize, sigma, norm) {
    // Check the incoming input is a video or a texture
    let img, imgWidth, imgHeight;
    if (video.isTexture) {
      img = video;
      imgWidth = img.image.width;
      imgHeight = img.image.height;
    } else {
      img = this.processVideo(video);
      imgWidth = img.image.videoWidth;
      imgHeight = img.image.videoHeight;
    }

    this.image = img;
    this.imageWidth = imgWidth;
    this.imageHeight = imgHeight;
    this.ipMaterial = new THREE.RawShaderMaterial({
      uniforms: {
        image: { type: "t", value: this.image },
        imageWidth: { type: "i", value: imgWidth },
        imageHeight: { type: "i", value: imgHeight },
        method: { type: "i", value: method },
        kernelSize: { type: "i", value: kernelSize },
        sigma: { type: "f", value: sigma },
        conv_lp_kernel: { type: "f", value: new Float32Array([-1, -1, -1, -1, 8, -1, -1, -1, -1]) },
        isDoublePass: { type: "b", value: isDoublePass },
        norm: { type: "f", value: norm },
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
    this.rtt = new THREE.WebGLRenderTarget(this.imageWidth, this.imageHeight, options);

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

  set sigma(value) {
    this.ipMesh.material.uniforms.sigma.value = value;
  }

  set kernelSize(value) {
    this.ipMesh.material.uniforms.kernelSize.value = value;
  }

  set norm(value) {
    this.ipMesh.material.uniforms.norm.value = value;
  }
}
