import { GUI } from "three/addons/libs/lil-gui.module.min.js";

// Setup the GUI
export function setupGui(videoController) {
  /* General settings */
  const gui = new GUI({ title: "Shader Image Processing" });

  // Settings
  const settings = {
    pausePlayVideo: videoController.pausePlayVideo.bind(videoController),
    setVideo: "city.mp4",
    aMethod: 2, // Anaglyph method
    ipMethod: 0, // Image processing method
    sigma: 4,
    kernelSize: 5,
    norm: 1,
  };

  gui
    .add(settings, "setVideo", { city: "city.mp4", moon: "moon.mp4" })
    .name("Choose video")
    .onChange((value) => {
      videoController.setVideo(value);
    });

  gui.add(settings, "pausePlayVideo").name("Pause | Play");

  // ----- IMAGE PROCESSING -----
  const ipFolder = gui.addFolder("Image Processing");

  ipFolder
    .add(settings, "ipMethod", {
      None: 99,
      "Convolutional Gaussian": 0,
      "Convolutional Laplacian": 1,
      "Separable Gaussian": 2,
      "Denoising Median": 3,
      "Gaussian + Laplacian": 4,
    })
    .name("Method")
    .onChange((value) => {
      videoController.settings.ipMethod = value;
      videoController.iProcessor.method = value;
      videoController.iProcessorDoublePass.method = value;
    });

  ipFolder
    .add(settings, "sigma")
    .name("Sigma")
    .min(0.1)
    .max(99)
    .onChange((value) => {
      videoController.settings.sigma = value;
      videoController.iProcessor.sigma = value;
      videoController.iProcessorDoublePass.sigma = value;
    });

  ipFolder
    .add(settings, "kernelSize")
    .name("Kernel size")
    .min(1)
    .max(5)
    .step(1)
    .onChange((value) => {
      videoController.settings.kernelSize = value;
      videoController.iProcessor.kernelSize = value;
      videoController.iProcessorDoublePass.kernelSize = value;
    });

  ipFolder
    .add(settings, "norm")
    .name("LoG norm")
    .min(0)
    .max(10)
    .onChange((value) => {
      videoController.settings.norm = value;
      videoController.iProcessor.norm = value;
      videoController.iProcessorDoublePass.norm = value;
    });

  // ----- ANAGLYPH -----
  const aFolder = gui.addFolder("Anaglyph");

  aFolder
    .add(settings, "aMethod", {
      None: 99,
      True: 0,
      Gray: 1,
      Color: 2,
      "Half Color": 3,
      Optimized: 4,
    })
    .name("Method")
    .onChange((value) => {
      videoController.settings.aMethod = value;
      videoController.anaglyph.method = value;
    });
}
