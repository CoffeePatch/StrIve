const ENABLE_PERF_LOGGING = import.meta.env.DEV;

export const logImageLoad = ({ source, url, mountTime, loadTime }) => {
  if (!ENABLE_PERF_LOGGING) return;
  
  const latency = loadTime - mountTime;
  console.debug(`[Performance] Image Load - ${source}: ${latency}ms (URL: ${url})`);
};
