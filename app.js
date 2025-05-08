import Frontend from "./Frontend.js";
import MainPlayer from "./MainPlayer.js";

const ui = new Frontend();
const player = new MainPlayer(ui);

ui.onStart((cfg) => player.start(cfg));
ui.onStop(() => player.stop());
ui.initUI();
