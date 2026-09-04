export function MeetingBotPage(): React.ReactElement {
  return (
    <>
      <div className="page-header">
        <h1>Meeting Bot</h1>
        <p>Not live yet &mdash; here's exactly what's real today and what isn't.</p>
      </div>

      <div className="card">
        <div className="section-title">Real and tested today</div>
        <div className="row-card">
          <div className="row-title">Platform detection</div>
          <div className="row-meta">Meet / Teams / Zoom / Webex correctly identified from a real meeting URL.</div>
        </div>
        <div className="row-card">
          <div className="row-title">Consent gate</div>
          <div className="row-meta">D-008 provided-first ordering enforced before any capture path runs.</div>
        </div>
        <div className="row-card">
          <div className="row-title">Join-strategy selection</div>
          <div className="row-meta">Routes to the right joiner (Vexa / browser-profile / system-audio) per platform.</div>
        </div>
        <div className="row-card">
          <div className="row-title">Private-segment exclusion</div>
          <div className="row-meta">A marked-private time window is dropped from the transcript before it's ever stored.</div>
        </div>
      </div>

      <div className="card empty-note">
        <strong>Not real yet:</strong> no joiner has ever actually joined a live meeting &mdash;
        every one (Vexa API call, browser-profile launch, system-audio capture) is still a
        tested-against-fakes stub. No real Vexa instance is configured, no real browser
        automation runs, no real OS audio device is opened. Building that live integration is
        genuine follow-up work, not something this page pretends is already connected.
      </div>
    </>
  );
}
