import Phaser from "phaser";
import { GAME, NET } from "../config/constants";
import { PALETTE, css } from "../config/palette";
import { NetBattle } from "../net/NetBattle";
import { leaveOnline, onlineClient, onlineName, setOnlineName } from "../net/session";
import { onKeyDown } from "../ui/keyboard";
import { textStyle } from "../ui/theme";

/**
 * The online lobby (docs/NETCODE.md, S2/S4): connects to the game server,
 * shows who is waiting and when the match starts, and switches to the game
 * screen when the server says "start". Empty seats are filled with bots by
 * the server, so a match can start with one person.
 */
export default class LobbyScene extends Phaser.Scene {
  private status!: Phaser.GameObjects.Text;
  private players!: Phaser.GameObjects.Text;
  private countdown!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;

  constructor() {
    super("LobbyScene");
  }

  create(): void {
    const cx = GAME.WIDTH / 2;
    this.add.text(cx, 64, "ONLINE BATTLE", textStyle(30, PALETTE.GOLD)).setOrigin(0.5);
    this.add
      .text(cx, 100, `${NET.SEATS} seats · empty seats are bots · one life`, textStyle(14, PALETTE.TEXT_MUTED))
      .setOrigin(0.5);

    this.nameText = this.add.text(cx, 150, "", textStyle(20)).setOrigin(0.5);
    this.makeButton(cx, 190, "CHANGE NAME", () => this.changeName(), 200, 16, 36);

    this.status = this.add.text(cx, 250, "", textStyle(16, PALETTE.TEXT_MUTED)).setOrigin(0.5).setAlign("center");
    this.countdown = this.add.text(cx, 300, "", textStyle(22, PALETTE.ACCENT)).setOrigin(0.5).setAlign("center");
    this.players = this.add.text(cx, 340, "", textStyle(18)).setOrigin(0.5, 0).setAlign("center").setLineSpacing(6);

    this.makeButton(cx, 582, "START NOW", () => onlineClient().send({ t: "go" }));
    this.makeButton(cx, 642, "BACK", () => this.back());

    const client = onlineClient();
    const stop = client.on((m) => {
      if (m.t !== "start") return;
      // Build the battle right away, so the server's next messages reach it.
      const battle = new NetBattle(client, m);
      this.scene.start("GameScene", { online: battle });
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
    onKeyDown(this, (e) => {
      if (e.key === "Escape") this.back();
      if (e.key === "Enter") onlineClient().send({ t: "go" });
    });
  }

  update(): void {
    const client = onlineClient();
    this.nameText.setText(`YOU: ${onlineName()}`);
    const rtt = client.rttMs === null ? "" : ` · ping ${Math.round(client.rttMs)} ms`;
    if (client.problem && client.state === "closed") {
      this.status.setText(`${client.problem}\n(is the game server running?)`).setColor(css(PALETTE.DANGER));
    } else if (client.state === "connecting" || client.id === null) {
      this.status.setText("connecting…").setColor(css(PALETTE.TEXT_MUTED));
    } else {
      this.status.setText(`connected${rtt}`).setColor(css(PALETTE.TEXT_MUTED));
    }

    const lobby = client.lobby;
    const startsIn = client.startsInMs(performance.now());
    if (!lobby) {
      this.countdown.setText("");
      this.players.setText("");
      return;
    }
    this.countdown.setText(
      lobby.running
        ? "a match is running:\nyou'll play the next one"
        : startsIn === null
          ? ""
          : `starts in ${Math.ceil(startsIn / 1000)} s`,
    );
    const empty = Math.max(0, NET.SEATS - lobby.players.length);
    this.players.setText(
      [...lobby.players, ...(empty ? [`+ ${empty} bot${empty > 1 ? "s" : ""}`] : [])].join("\n"),
    );
  }

  private changeName(): void {
    // The browser's own prompt: a real text field with the phone keyboard.
    const name = window.prompt(`Your name (letters and digits, up to ${NET.NAME_MAX}):`, onlineName());
    if (name === null) return;
    setOnlineName(name);
    // The name goes in the hello: reconnect with the new one.
    leaveOnline();
    this.scene.restart();
  }

  private back(): void {
    leaveOnline();
    this.scene.start("MenuScene");
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void, w = 260, size = 24, h = 52): void {
    const bg = this.add
      .rectangle(x, y, w, h, PALETTE.PANEL)
      .setStrokeStyle(2, PALETTE.ACCENT)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, textStyle(size)).setOrigin(0.5);
    bg.on("pointerover", () => text.setColor(css(PALETTE.GOLD)));
    bg.on("pointerout", () => text.setColor(css(PALETTE.TEXT)));
    bg.on("pointerdown", onClick);
  }
}
