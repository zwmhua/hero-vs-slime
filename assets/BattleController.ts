import { _decorator, Button, Color, Component, Graphics, Label, Node, UITransform } from 'cc';
import { battleConfig } from './BattleConfig';
import { battleOutcome, resolveTurn, startBattle } from './logic/Battle';
import type { BattleAction } from './logic/Battle';

const buttonColor = new Color(54, 89, 138);
const disabledButtonColor = new Color(75, 75, 75);
const chargingNameColor = new Color(255, 105, 105);

@_decorator.ccclass('BattleController')
export class BattleController extends Component {
    private ui: Node;
    private heroHP: Label;
    private rageLabel: Label;
    private slimeHP: Label;
    private slimeName: Label;
    private log: Label;
    private attack: Button;
    private defend: Button;
    private charge: Button;
    private restart: Button;
    private battle = startBattle();
    private locked = false;
    private messages: string[] = [];

    onLoad() {
        this.node.getChildByName('GameTitle')!.getComponent(Label)!.string = '勇者与史莱姆';
        this.ui = new Node('BattleUI');
        this.ui.layer = this.node.layer;
        this.node.addChild(this.ui);

        this.panel(this.ui, 'Hero', -155, 85, 270, 140, new Color(37, 59, 87));
        this.panel(this.ui, 'Slime', 155, 85, 270, 140, new Color(33, 72, 64));
        this.label(this.ui, 'HeroMark', '◆', -155, 113, 38, new Color(150, 202, 255));
        this.label(this.ui, 'SlimeMark', '●', 155, 113, 42, new Color(144, 237, 170));
        this.heroHP = this.label(this.ui, 'HeroHP', '', -155, 62, 26);
        this.rageLabel = this.label(this.ui, 'Rage', '', -155, 32, 20);
        this.slimeName = this.label(this.ui, 'SlimeName', '史莱姆', 94, 62, 26);
        this.slimeHP = this.label(this.ui, 'SlimeHP', '', 205, 62, 26);
        this.panel(this.ui, 'LogPanel', 0, -71, 580, 140, new Color(26, 33, 46));
        this.label(this.ui, 'LogTitle', '战斗日志', 0, -23, 22, new Color(184, 203, 226));
        this.log = this.label(this.ui, 'BattleLog', '', 0, -88, 24);

        this.attack = this.button('攻击', -200, () => this.playTurn('attack'));
        this.defend = this.button('防御', 0, () => this.playTurn('defend'));
        this.charge = this.button('蓄力攻击', 200, () => this.playTurn('charge'));
        this.restart = this.button('重新开始', 0, () => this.resetBattle());
        this.resetBattle();
    }

    private resetBattle() {
        this.battle = startBattle();
        this.locked = false;
        this.messages = ['史莱姆出现了！勇者先行动。'];
        this.render();
    }

    private playTurn(action: BattleAction) {
        if (this.locked) return;
        const { slimeCharging: heavy } = this.battle;
        const result = resolveTurn(this.battle, action);
        if (!result) return;
        this.battle = result.state;
        this.locked = true;

        const { strike, interrupted, counter } = result;
        const defending = action === 'defend';
        let message = defending ? '勇者防御' : `勇者攻击，造成 ${strike} 点伤害`;
        if (action === 'charge') message = `勇者蓄力攻击，造成 ${strike} 点伤害`;
        if (interrupted) message += '，打断史莱姆重击！';
        if (counter) {
            const { damage, blocked, gained } = counter;
            message += defending ? `，抵挡${heavy ? '重击' : ''} ${blocked} 点，受到 ${damage} 点伤害。`
                : `，史莱姆${heavy ? '重击' : '反击'} ${damage} 点。`;
            if (gained > 0) message += `\n怒气 +${gained}`;
        }
        this.messages.push(...message.split('\n'));
        if (this.battle.slimeCharging) this.messages.push('史莱姆正在蓄力，下回合将发动重击！');
        const outcome = battleOutcome(this.battle);
        if (outcome === 'victory') this.messages.push('胜利！勇者击败了史莱姆。');
        if (outcome === 'defeat') this.messages.push('战败！勇者倒下了。');
        this.render();

        if (!outcome) {
            this.scheduleOnce(() => {
                this.locked = false;
                this.render();
            }, battleConfig.turnLockSeconds);
        }
    }

    private render() {
        this.heroHP.string = `勇者   HP ${this.battle.hero} / ${battleConfig.hero.hp}`;
        this.rageLabel.string = `怒气 ${this.battle.rage}/${battleConfig.rage.max}`;
        this.slimeName.color = this.battle.slimeCharging ? chargingNameColor : Color.WHITE;
        this.slimeHP.string = `HP ${this.battle.slime} / ${battleConfig.slime.hp}`;
        this.messages = this.messages.slice(-3);
        this.log.string = this.messages.join('\n');
        const ended = battleOutcome(this.battle) !== null;
        this.attack.node.active = this.defend.node.active = !ended;
        this.attack.interactable = this.defend.interactable = !ended && !this.locked;
        this.charge.node.active = !ended;
        this.charge.interactable = this.attack.interactable && this.battle.rage === battleConfig.rage.max;
        const chargeNode = this.charge.node;
        this.paintPanel(chargeNode, this.charge.interactable ? buttonColor : disabledButtonColor);
        this.restart.node.active = ended;
    }

    private child(parent: Node, name: string, x: number, y: number) {
        const node = new Node(name);
        node.layer = parent.layer;
        parent.addChild(node);
        node.setPosition(x, y);
        return node;
    }

    private label(parent: Node, name: string, value: string, x: number, y: number, size: number, color = Color.WHITE) {
        const label = this.child(parent, name, x, y).addComponent(Label);
        label.fontSize = size;
        label.lineHeight = size + 4;
        label.color = color;
        label.string = value;
        return label;
    }

    private panel(parent: Node, name: string, x: number, y: number, width: number, height: number, color: Color) {
        const node = this.child(parent, name, x, y);
        node.addComponent(UITransform).setContentSize(width, height);
        node.addComponent(Graphics);
        this.paintPanel(node, color);
        return node;
    }

    private paintPanel(node: Node, color: Color) {
        const graphic = node.getComponent(Graphics)!;
        const { width, height } = node.getComponent(UITransform)!;
        if (graphic.fillColor.equals(color)) return;
        graphic.clear();
        graphic.fillColor = color;
        graphic.roundRect(-width / 2, -height / 2, width, height, 12);
        graphic.fill();
    }

    private button(text: string, x: number, click: () => void) {
        const node = this.panel(this.ui, text, x, -191, 178, 60, buttonColor);
        const button = node.addComponent(Button);
        button.target = node;
        this.label(node, 'Caption', text, 0, 0, 28);
        node.on(Button.EventType.CLICK, click, this);
        return button;
    }
}
