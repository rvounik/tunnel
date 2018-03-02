
// init general vars & constants
var pi = 3.14; // shortened pi to speed up math
var ts = 0;    // set initial sine offset
var texWidth      = 32; // keep this tied to real texture size
var texHeight     = 32;
var screenWidth   = w = 320;
var screenHeight  = h = 240;
var pixelmode     = 2; // specify 2 for 2x2, 4 for 4x4 etc
ratio             = 25; // texture zoom factor
var distanceTable = []; // inverted distance from pixel to screen centre
var angleTable    = []; // angle to screen centre
var tileList      = []; // will hold the pixel instances
var loadingInterval = 0, preload; // set preload interval
var lightsActive    = false; // toggles light sourcing (needs work)

document.getElementById("lightsourcing").addEventListener("click", function (){
  lightsActive = this.checked;
  lights.visible = this.checked;
});

function preload() {

  // open screen
  canvas = document.getElementById("myCanvas");
  stage = new createjs.Stage(canvas);
  context = canvas.getContext("2d");

  // add preload assets
  progresstext = new createjs.Text('please wait', "10px Arial", "#fff");
  progresstext.x = 35;
  progresstext.y = 10;
  stage.addChild(progresstext);
  progressbar = new createjs.Shape();
  progressbar.graphics.beginFill("#000").drawRect(10, 30, 100, 5);
  stage.addChild(progressbar);
  progress = new createjs.Shape();
  stage.addChild(progress);
  stage.update(); // update so preloader is shown

  // define all preloaded assets
  var manifest = [
    {id:"tunnel", src:"img/tunnel_32.jpg"},
    {id:"mask", src:"img/tunnel_mask.png"},
    {id:"lights", src:"img/tunnel_lights.png"}
  ];

  // preload the assets
  preload = new createjs.LoadQueue();
  preload.installPlugin(createjs.Image);
  preload.addEventListener("complete", doneLoading);
  preload.addEventListener("progress", updateLoading);
  preload.loadManifest(manifest);

}

function updateLoading(event) {
  progress.graphics.clear();
  progress.graphics.beginFill("#fff").drawRect(10, 30, 100 * (event.loaded / event.total), 5); // update loading graph
  stage.update();
}

function doneLoading(event) {

  // clean up preload assets
  clearInterval(loadingInterval);
  stage.removeChild(progress);
  stage.removeChild(progressbar);
  stage.removeChild(progresstext);

  createjs.Ticker.addEventListener("tick", handleTick);
  createjs.Ticker.setFPS(50);
  //createjs.Ticker.useRAF = true; // use Request Animation Frame - warning: much slower

  // build main container
  mainContainer = new createjs.Container();
  mainContainer.x = mainContainer.y = 0;
  stage.addChild(mainContainer);

  preCalc();

}

function preCalc() {

  // store data for every pixel in the bitmap in a new bitmapArray todo: what happens when you store 2 bitmaps in 2 tables and alternate between them on each pixel read at random?
  tunnel = preload.getResult("tunnel");
  tunnel = new createjs.Bitmap(tunnel);
  tunnel.x = 0;
  tunnel.y = 0;
  mainContainer.addChild(tunnel);
  stage.update();
  bmpArray  = [];
  tempArray = [];
  for(bmph = 0; bmph < texHeight; bmph ++){
    for(bmpw = 0; bmpw < texWidth; bmpw ++){
      imgData = context.getImageData(bmpw,bmph,1,1).data; // standard html5 canvas method that copies image data (x,y,w,h) including color value, which is what we need here
      color = rgbToHex(imgData[0],imgData[1],imgData[2]); // note we dont take the alpha bit
      tempArray.push(color);
    }
    bmpArray.push(tempArray);
    tempArray=[];
  }
  mainContainer.removeChild(tunnel);

  // add fps counter (add it after adding and removing the tunnel texture, else its colour values are stored in bmparray!)
  fps = new createjs.Text("fps", "8px Arial", "#fff");
  fps.y = 3;
  fps.x = 1;

  // enable this for fps
  // stage.addChild(fps);

  // generate non-linear transformation table
  for(var x = 0; x < w; x ++) {

    var tempDistanceTable = [];
    var tempAngleTable = [];

    for(var y = 0; y < h; y ++) {
      distance = parseInt(ratio * texHeight / Math.sqrt((x - w / 2) * (x - w / 2) + (y - h / 2) * (y - h / 2))) % texHeight;
      if(distance == 0 || isNaN(distance)){distance = 0.001} // dirty hack to prevent dividing by zero
      tempDistanceTable.push(distance);

      angle = 180 + ((0.5 * texWidth) * Math.atan2(y - (h / 2), x - (w / 2)) / pi); // see that 256? that was 2. sth is up with texture offset. this fixed it, for now.
      if(angle == 0 || isNaN(angle)){angle = 0.001} // dirty hack to prevent dividing by zero
      tempAngleTable.push(angle);
    }

    distanceTable.push(tempDistanceTable);
    angleTable.push(tempAngleTable);

  }

  // create initial shapes (the pixels)
  for(x = 0; x < w / pixelmode; x += 1) {
    for(y = 0; y < h / pixelmode; y += 1) {
      // get the texel from the texture by using the precalculated lookup tables
      fx = distanceTable[x][y] % texWidth; // use modulus so the texture wraps around
      fy = angleTable[x][y] % texHeight;
      tile = new createjs.Shape(); // draw a rectangle at this position (colouring happens in timer function)
      tile.x = x * pixelmode; // set x,y position multiplied by pixelmode
      tile.y = y * pixelmode;
      tile.fx = fx; // store texel as a local so we can shift it later from timer function
      tile.fy = fy;
      mainContainer.addChild(tile); // add to stage
      tileList.push(tile); // store in array so it can be referenced from timer function
      //tile.cache(0, 0, pixelmode, pixelmode); // too slow with this many instances
    }
  }

  // add mask
  mask = preload.getResult("mask");
  mask = new createjs.Bitmap(mask);
  mask.scaleX = mask.scaleY = 4;
  mask.x = screenWidth/2 -  (32*4)/2; // mask width is hardcoded here
  mask.y = screenHeight/2 - (32*4)/2; // mask width is hardcoded here
  mainContainer.addChild(mask);

  // add lights
  lights = preload.getResult("lights");
  lights = new createjs.Bitmap(lights);
  lights.scaleX = lights.scaleY = 2;
  lights.regX = 64;
  lights.regY = 64;
  lights.x = 64;
  lights.y = 64;
  mainContainer.addChild(lights);
  if (!lightsActive) {lights.visible = false}

}

function componentToHex(c) {
  var hex = c.toString(16);
  return hex.length === 1 ? "0" + hex : hex;
}
function rgbToHex(r, g, b) {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function handleTick() {

  ts += 0.5; // increment sine
  ts1 = ts * 2; // precalc some stuff
  ts2 = ts / 3;
  tl = 0; // reset iteration loop

  while(tl < tileList.length){
    tile = tileList[tl];
    tile.fx = ((distanceTable[tile.x][tile.y] + ts1) % texWidth);
    tile.fy = ((angleTable[tile.x][tile.y]    + ts2) % texHeight);
    tile.graphics.clear().beginFill(bmpArray[parseInt(tile.fx)][parseInt(tile.fy)]).drawRect(0, 0, pixelmode, pixelmode).endFill(); // set new color
    tl++;
  }

  if(lightsActive){
    lights.rotation += 1.5;
  }

  fps.text = Math.round(createjs.Ticker.getMeasuredFPS())+" fps"; // update fps

  stage.update();

}

