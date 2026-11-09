import { _decorator, Button, Color, Component, Graphics, Label, Node, UITransform } from 'cc';
import { battleConfig } from './BattleConfig';

const buttonColor = new Color(54, 89, 138);
const disabledButtonColor = new Color(75, 75, 75);

@_decorator.ccclass('BattleController')
export class BattleController extends Component {
    private ui: Node;
    private heroHP: Label;
    private rageLabel: Label;
    private slimeHP: Label;
    private log: Label;
    private attack: Button;
    private defend: Button;
    private charge: Button;
    private restart: Button;
    private hero = 0;
    private slime = 0;
    private turn = 0;
    private rage = 0;
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
        this.slimeHP = this.label(this.ui, 'SlimeHP', '', 155, 62, 26);
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
        this.hero = battleConfig.hero.hp;
        this.slime = battleConfig.slime.hp;
        this.turn = 0;
        this.rage = 0;
        this.locked = false;
        this.messages = ['史莱姆出现了！勇者先行动。'];
        this.render();
    }

    private playTurn(action: 'attack' | 'defend' | 'charge') {
        if (this.locked || this.hero === 0 || this.slime === 0) return;
        if (action === 'charge' && this.rage < battleConfig.rage.max) return;
        const defending = action === 'defend';
        this.locked = true;
        this.turn++;

        let strike = 0;
        if (action === 'attack') strike = this.roll(battleConfig.hero.damage);
        if (action === 'charge') {
            strike = battleConfig.rage.chargedDamage;
            this.rage = 0;
        }
        this.slime = Math.max(0, this.slime - strike);
        let message = defending ? '勇者防御' : `勇者攻击，造成 ${strike} 点伤害`;
        if (action === 'charge') message = `勇者蓄力攻击，造成 ${strike} 点伤害`;
        if (this.slime > 0) {
            const { damage: range, heavyEvery, heavyMultiplier } = battleConfig.slime;
            const heavy = this.turn % heavyEvery === 0;
            const strikeBack = this.roll(range) * (heavy ? heavyMultiplier : 1);
            const damage = defending ? Math.ceil(strikeBack * battleConfig.defenseMultiplier) : strikeBack;
            const hpLost = Math.min(this.hero, damage);
            this.hero -= hpLost;
            const gained = Math.min(battleConfig.rage.max - this.rage, Math.ceil(hpLost / battleConfig.rage.hpPerPoint));
            this.rage += gained;
            message += defending ? `，抵挡${heavy ? '重击' : ''} ${strikeBack - damage} 点，受到 ${damage} 点伤害。`
                : `，史莱姆${heavy ? '重击' : '反击'} ${damage} 点。`;
            if (gained > 0) message += `\n怒气 +${gained}`;
        }
        this.messages.push(...message.split('\n'));
        if (this.hero > 0 && this.slime > 0 && (this.turn + 1) % battleConfig.slime.heavyEvery === 0) {
            this.messages.push('史莱姆正在蓄力，下回合将发动重击！');
        }
        if (this.slime === 0) this.messages.push('胜利！勇者击败了史莱姆。');
        if (this.hero === 0) this.messages.push('战败！勇者倒下了。');
        this.render();

        if (this.hero > 0 && this.slime > 0) {
            this.scheduleOnce(() => {
                this.locked = false;
                this.render();
            }, battleConfig.turnLockSeconds);
        }
    }

    private render() {
        this.heroHP.string = `勇者   HP ${this.hero} / ${battleConfig.hero.hp}`;
        this.rageLabel.string = `怒气 ${this.rage}/${battleConfig.rage.max}`;
        this.slimeHP.string = `史莱姆   HP ${this.slime} / ${battleConfig.slime.hp}`;
        this.messages = this.messages.slice(-3);
        this.log.string = this.messages.join('\n');
        const ended = this.hero === 0 || this.slime === 0;
        this.attack.node.active = this.defend.node.active = !ended;
        this.attack.interactable = this.defend.interactable = !ended && !this.locked;
        this.charge.node.active = !ended;
        this.charge.interactable = this.attack.interactable && this.rage === battleConfig.rage.max;
        const chargeNode = this.charge.node;
        this.paintPanel(chargeNode, this.charge.interactable ? buttonColor : disabledButtonColor);
        this.restart.node.active = ended;
    }

    private roll([min, max]: readonly [number, number]) {
        return min + Math.floor(Math.random() * (max - min + 1));
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
