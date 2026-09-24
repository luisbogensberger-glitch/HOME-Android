/* HOME remote runtime JS. Loaded after the stable adaptive runtime.
 * This file is intentionally replaceable without shipping a new APK.
 */
(function(){
  window.HOMERemote={version:1,loadedAt:Date.now(),capabilities:{tubeStructure:true,todoStructure:true,quizFormats:true,readerFormats:true,swipeModes:true,visualTheme:true}};
  document.documentElement.dataset.homeRemoteRuntime='1';
  if(window.homeAdaptiveLog)window.homeAdaptiveLog('remote_runtime_ready',{version:1});
})();
