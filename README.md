# Image Processing with Shaders

This readme will briefly explain the different components used in the implementation of this practical work.

**IMPORTANT**: the two stereo videos are name `city.mp4` and `moon.mp4`. They must be downloaded from YouTube and placed in the root directory (same as this README.md). Links:
- [City](https://www.youtube.com/watch?v=fs_Uw4qL2O8)
- [Moon](https://www.youtube.com/watch?v=_FgCK6CdR8s)

## Exercise 1: 3D Environment

The files `index.html` and `src/MyGui.js` contain everything required in this exercise.

## Exercise 2: Anaglyph color methods

All anaglyph method were implemented and can be found in the fragment shader inside `src/Anaglyph.js`. The `Anaglyph` class is used in `src/VideoController.js` to apply the anaglyphs to the output of the second image processing render target. Different anaglyphs are selected with the `method` parameter, passed in as an uniform to the fragment shader.

## Exercise 3: Image processing methods

All image processing methods were implemented and can be found in the fragment shader inside `src/ImageProcessing.js`. The parameter `method` is used to select which method should be applied, and the GUI contains all other parameters (sigma, kernel size, and norm).

*How to correctly process the pixels on the edges of the images?* As commented inside `src/ImageProcessing.js` (line 141):

```c
/* NOTE ON BOUNDARY FIX
    Implemented solution: shift the kernel away from the border.

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
```