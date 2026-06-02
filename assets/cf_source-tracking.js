/**
 * Tracks sources for Cart Freebie
 * For Cart Freebies that are only added if coming from a specific source
 *
 * This file should be included in theme.liquid as a module
 * {% comment %}
 * ```
    <link href="preload" href="{{ 'cf_source-tracking.js' | asset_url }}" as="script">
    <script src="{{ 'cf_source-tracking.js' | asset_url }}" type="module"></script>
 * ```
 * {% endcomment %}
 *
 * The CartFreebie section will later check for this value and add the Cart Freebie
 */
trackSources();
function trackSources() {
  document.addEventListener("DOMContentLoaded", trackCFSource);

  /**
   * This function gets a URL param cf_source and stores it for the session
   *
   * By using a named function, we prevent adding the same event listener multiple times
   * https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#sect2
   */
  function trackCFSource() {
    const urlParams = new URLSearchParams(window.location.search);
    const cf_source = urlParams.get("cf_source") || sessionStorage.getItem("jod-cf-source");
    if (cf_source) {
      sessionStorage.setItem("jod-cf-source", cf_source);
    }
  }
}

/**
 * Check for Cart Freebies that should only be added if coming from a specific source
 * Verifies the cf_source param is in the sessionStorage and equal to the given referralCode
 * @param {string} referralCode
 * @returns {boolean}
 */
export function meetsReferralCompliance(referralCode) {
  trackSources();
  const referralCodeExists = !!sessionStorage.getItem("jod-cf-source");
  if (
    !referralCode.length ||
    (!referralCode.length && !referralCodeExists)
  ) return true;

  const referralCodeMatches = sessionStorage.getItem("jod-cf-source") == referralCode
  console.log('CF: meetsReferralCompliance', referralCodeMatches);
  return referralCodeMatches;
}
