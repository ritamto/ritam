// The React part. It shows the score, world name and buttons.
// The game itself (game.js) draws on the canvas and tells React what changed.

var useState = React.useState;
var useEffect = React.useEffect;
var useRef = React.useRef;
var html = htm.bind(React.createElement);   // lets us write HTML-looking markup inside backticks

function Arcade() {
  var canvasRef = useRef(null);
  var gameRef = useRef(null);
  var info = useState({ status: "ready", score: 0, best: 0, world: "Office" });
  var s = info[0], setInfo = info[1];
  var soundState = useState(false);
  var sound = soundState[0], setSound = soundState[1];

  // Start the game once, when the page first appears
  useEffect(function () {
    gameRef.current = createRunner(canvasRef.current, setInfo);
    return function () { gameRef.current.destroy(); };
  }, []);

  // Tell the game when sound is switched on or off
  useEffect(function () {
    if (gameRef.current) gameRef.current.setSound(sound);
  }, [sound]);

  return html`
    <main className="wrap">
      <a href="/">← Back to the workshop</a>
      <h1>Overtime</h1>
      <p className="sub">Run through the worlds. Don't get clocked out.</p>

      <div className="hud">
        <span>World <b>${s.world}</b></span>
        <span>Score <b>${s.score}</b></span>
        <span>Best <b>${s.best}</b></span>
      </div>

      <canvas ref=${canvasRef} width="320" height="180" aria-label="Overtime game"></canvas>

      <div className="row">
        <button onClick=${function (e) { gameRef.current.start(); e.currentTarget.blur(); }}>
          ${s.status === "playing" ? "Restart" : "Start"}
        </button>
        <button onClick=${function (e) { setSound(!sound); e.currentTarget.blur(); }}>
          Sound: ${sound ? "on" : "off"}
        </button>
      </div>

      <ul className="help">
        <li>Space, Up arrow or W (or tap the top of the screen): jump</li>
        <li>Down arrow or S (or hold the bottom of the screen): duck</li>
        <li>Coffee: a few seconds where nothing can hurt you</li>
        <li>The glowing doorway takes you to the next world</li>
      </ul>
    </main>
  `;
}

ReactDOM.createRoot(document.getElementById("root")).render(html`<${Arcade} />`);
