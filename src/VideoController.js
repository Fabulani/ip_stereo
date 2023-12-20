import * as THREE from "three";
import { ImageProcessor } from "./ImageProcessing.js";
import { Anaglyph } from "./Anaglyph.js";

export class VideoController {
  constructor(scene, video, canvas) {
    this.scene = scene;
    this.video = video;
    this.canvas = canvas;
    this.settings = {
      // Fixes GUI resetting parameters when changing video
      aMethod: 2,
      ipMethod: 0,
      kernelSize: 5,
      sigma: 4,
      norm: 1,
    };
  }

  setVideo(video) {
    /* Set the video source */
    this.video.src = video;
    this.video.load();
    this.video.muted = true;
    this.video.loop = true;
    this.video.onloadeddata = this.#pipeline.bind(this);
    return;
  }

  pausePlayVideo() {
    if (!this.video.paused) {
      this.video.pause();
    } else {
      this.video.play();
    }
  }

  #pipeline() {
    // Pipeline for image processing and applying the anaglyph.
    this.iProcessor = new ImageProcessor(
      this.video,
      this.canvas,
      false,
      this.settings["ipMethod"],
      this.settings["kernelSize"],
      this.settings["sigma"],
      this.settings["norm"]
    );
    this.iProcessorDoublePass = new ImageProcessor(
      this.iProcessor.rtt.texture,
      this.canvas,
      true,
      this.settings["ipMethod"],
      this.settings["kernelSize"],
      this.settings["sigma"],
      this.settings["norm"]
    ); // For rendering separable filters
    this.anaglyph = new Anaglyph(this.iProcessorDoublePass.rtt.texture, this.canvas, this.settings["aMethod"]);

    var geometry = new THREE.PlaneGeometry(1, this.video.videoHeight / this.video.videoWidth);
    var material = new THREE.MeshBasicMaterial({
      map: this.anaglyph.rtt.texture,
      side: THREE.FrontSide,
    });
    var videoPlane = new THREE.Mesh(geometry, material);
    videoPlane.receiveShadow = false;
    videoPlane.castShadow = false;
    videoPlane.name = "videoPlane";

    const old_plane = this.scene.getObjectByName("videoPlane");
    if (old_plane) {
      this.scene.remove(old_plane);
    }
    this.scene.add(videoPlane);

    this.video.play();
  }
}
