import { _decorator, Button, Color, Component, EffectAsset, Graphics, Label, Material, Node, Sprite, SpriteFrame, Texture2D, Tween, UIOpacity, UITransform, Vec3, tween } from 'cc';
import { battleConfig } from './BattleConfig';
import { advanceEncounter, battleOutcome, resolveTurn, runStatus, startRun } from './logic/Battle';
import type { BattleAction } from './logic/Battle';

const buttonColor = new Color(54, 89, 138);
const disabledButtonColor = new Color(75, 75, 75);
const chargingNameColor = new Color(255, 105, 105);

const presentation = {
    actorSize: 382, actorY: 40, floatY: 176, floatRise: 60,
    poseTime: 0.4, counterDelay: 0.16, flashTime: 0.1, floatTime: 0.58,
    recoil: 18, kickTime: 0.045, returnTime: 0.15, shake: 7, redOpacity: 65,
    chargeScale: 1.12, chargeBreath: 0.045, buttonPulse: 0.06, pulseTime: 0.36,
    lockedOpacity: 210, resultDelay: 0.6, fallTime: 0.24, fadeTime: 0.22,
    heroFallAngle: -80, heroSink: 38, heroBrightness: 0.6,
    slimeSquash: 0.5, slimeSink: 80, slimeOpacity: 0.3,
} as const;

// Order matches the scene's texture references.
enum Pose { HeroIdle, HeroAttack, HeroDefend, HeroHurt, SlimeIdle, SlimeCharge, SlimeHeavy, SlimeHurt, SlimeStunned }
type Actor = { sprite: Sprite; white: Sprite; opacity: UIOpacity; x: number };

@_decorator.ccclass('BattleController')
export class BattleController extends Component {
    @_decorator.property([Texture2D])
    private poseTextures: Texture2D[] = [];
    @_decorator.property(EffectAsset)
    private hitFlashEffect: EffectAsset | null = null;
    private frames: SpriteFrame[];
    private heroArt: Actor;
    private slimeArt: Actor;
    private effects: Node;
    private redFlash: UIOpacity;
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
    private next: Button;
    private encounterLabel: Label;
    private run = startRun();

    private get battle() {
        return this.run.battle;
    }
    private locked = false;
    private messages: string[] = [];

    onLoad() {
        this.node.getChildByName('GameTitle')!.getComponent(Label)!.string = '勇者与史莱姆';
        this.ui = new Node('BattleUI');
        this.ui.layer = this.node.layer;
        this.node.addChild(this.ui);
        this.encounterLabel = this.label(this.ui, 'Encounter', '', 245, 410, 30);

        this.frames = this.poseTextures.map(texture => Object.assign(new SpriteFrame(), { texture }));
        const flashMaterial = new Material();
        flashMaterial.initialize({ effectAsset: this.hitFlashEffect! });
        this.heroArt = this.actor('HeroArt', -181, flashMaterial);
        this.slimeArt = this.actor('SlimeArt', 181, flashMaterial);
        this.panel(this.ui, 'Hero', -181, 310, 338, 112, new Color(37, 59, 87));
        this.panel(this.ui, 'Slime', 181, 310, 338, 112, new Color(33, 72, 64));
        this.heroHP = this.label(this.ui, 'HeroHP', '', -181, 331, 34);
        this.rageLabel = this.label(this.ui, 'Rage', '', -181, 286, 28);
        this.slimeName = this.label(this.ui, 'SlimeName', '史莱姆', 181, 331, 34);
        this.slimeHP = this.label(this.ui, 'SlimeHP', '', 181, 286, 32);
        this.panel(this.ui, 'LogPanel', 0, -239, 700, 220, new Color(26, 33, 46));
        this.label(this.ui, 'LogTitle', '战斗日志', 0, -159, 28, new Color(184, 203, 226));
        this.log = this.label(this.ui, 'BattleLog', '', 0, -256, 32);
        this.log.overflow = Label.Overflow.RESIZE_HEIGHT;
        this.log.node.getComponent(UITransform)!.setContentSize(650, 0);

        this.attack = this.button('攻击', -235, () => this.playTurn('attack'));
        this.defend = this.button('防御', 0, () => this.playTurn('defend'));
        this.charge = this.button('蓄力攻击', 235, () => this.playTurn('charge'));
        this.restart = this.button('重新开始', 0, () => this.resetBattle());
        this.next = this.button('下一场', 0, () => {
            const next = advanceEncounter(this.run);
            if (next) this.resetBattle(next);
        });
        this.effects = this.child(this.ui, 'Feedback', 0, 0);
        const { width, height } = this.node.getComponent(UITransform)!;
        this.redFlash = this.panel(this.node, 'HeavyFlash', 0, 0, width, height, new Color(220, 18, 35)).addComponent(UIOpacity);
        this.resetBattle();
    }

    private resetBattle(run = startRun()) {
        this.clearFeedback();
        this.pose(this.heroArt, Pose.HeroIdle);
        this.pose(this.slimeArt, Pose.SlimeIdle);
        this.run = run;
        this.locked = false;
        this.messages = ['史莱姆出现了！勇者先行动。'];
        this.render();
    }

    private playTurn(action: BattleAction) {
        if (this.locked) return;
        const { slimeCharging: heavy } = this.battle;
        const result = resolveTurn(this.battle, action);
        if (!result) return;
        this.run.battle = result.state;
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
        this.render();
        this.playFeedback(action, result, heavy);
    }

    private render() {
        this.encounterLabel.string = `第 ${this.run.encounter}/${battleConfig.encounterCount} 场`;
        this.heroHP.string = `勇者   HP ${this.battle.hero} / ${battleConfig.hero.hp}`;
        this.rageLabel.string = `怒气 ${this.battle.rage}/${battleConfig.rage.max}`;
        this.slimeName.color = this.battle.slimeCharging ? chargingNameColor : Color.WHITE;
        this.slimeHP.string = `HP ${this.battle.slime} / ${battleConfig.slime.hp}`;
        this.messages = this.messages.slice(-3);
        this.log.string = this.messages.join('\n');
        const status = runStatus(this.run);
        const ended = status !== null;
        this.attack.node.active = this.defend.node.active = !ended;
        this.attack.interactable = this.defend.interactable = !ended && !this.locked;
        this.charge.node.active = !ended;
        this.charge.interactable = this.attack.interactable && this.battle.rage === battleConfig.rage.max;
        const chargeNode = this.charge.node;
        Tween.stopAllByTarget(chargeNode);
        chargeNode.setScale(1, 1, 1);
        this.paintPanel(chargeNode, this.charge.interactable ? new Color(67, 133, 203) : disabledButtonColor);
        if (this.charge.interactable) this.pulse(chargeNode, 1, presentation.buttonPulse);
        for (const button of [this.attack, this.defend, this.charge]) {
            button.node.getComponent(UIOpacity)!.opacity = this.locked ? presentation.lockedOpacity : 255;
        }
        this.next.node.active = !this.locked && status === 'next';
        this.restart.node.active = !this.locked && (status === 'defeat' || status === 'cleared');
    }

    private actor(name: string, x: number, material: Material): Actor {
        const body = this.child(this.ui, name, x, presentation.actorY);
        const sprite = body.addComponent(Sprite);
        const white = this.child(body, 'WhiteFlash', 0, 0).addComponent(Sprite);
        for (const layer of [sprite, white]) {
            layer.sizeMode = Sprite.SizeMode.CUSTOM;
            layer.trim = false;
            layer.node.getComponent(UITransform)!.setContentSize(presentation.actorSize, presentation.actorSize);
        }
        white.customMaterial = material;
        white.node.active = false;
        return { sprite, white, opacity: body.addComponent(UIOpacity), x };
    }

    private pose(actor: Actor, index: number) {
        actor.sprite.spriteFrame = actor.white.spriteFrame = this.frames[index];
    }

    private clearFeedback() {
        for (const target of [this.effects, this.ui, this.redFlash]) Tween.stopAllByTarget(target);
        this.ui.setPosition(0, 0);
        this.redFlash.opacity = 0;
        for (const actor of [this.heroArt, this.slimeArt]) {
            Tween.stopAllByTarget(actor.sprite.node);
            Tween.stopAllByTarget(actor.white.node);
            actor.white.node.active = false;
            actor.sprite.node.setPosition(actor.x, presentation.actorY);
            actor.sprite.node.setScale(1, 1, 1);
            actor.sprite.node.angle = 0;
            actor.sprite.color = Color.WHITE;
            Tween.stopAllByTarget(actor.opacity);
            actor.opacity.opacity = 255;
        }
        for (const node of [...this.effects.children]) {
            Tween.stopAllByTarget(node.getComponent(UIOpacity)!);
            node.destroy();
        }
    }

    private floatText(value: string, x: number, size: number, color: Color) {
        const node = this.label(this.effects, 'Feedback', value, x, presentation.floatY, size, color).node;
        const fade = node.addComponent(UIOpacity);
        tween(fade).to(presentation.floatTime, { opacity: 0 }, {
            onUpdate: (_, ratio = 0) => node.setPosition(x, presentation.floatY + presentation.floatRise * ratio),
        }).call(() => node.destroy()).start();
    }

    private hit(actor: Actor, damage: number, heavy = false) {
        actor.white.node.active = true;
        tween(actor.white.node).delay(presentation.flashTime).call(() => { actor.white.node.active = false; }).start();
        const offset = Math.sign(actor.x) * presentation.recoil;
        tween(actor.sprite.node)
            .to(presentation.kickTime, { position: new Vec3(actor.x + offset, presentation.actorY) })
            .to(presentation.returnTime, { position: new Vec3(actor.x, presentation.actorY) }).start();
        this.floatText(`−${damage}`, actor.x, heavy ? 52 : 34, heavy ? new Color(255, 97, 78) : Color.WHITE);
    }

    private playFeedback(action: BattleAction, result: NonNullable<ReturnType<typeof resolveTurn>>, heavy: boolean) {
        this.clearFeedback();
        const { strike, interrupted, counter } = result;
        this.pose(this.heroArt, action === 'defend' ? Pose.HeroDefend : Pose.HeroAttack);
        this.pose(this.slimeArt, interrupted ? Pose.SlimeStunned : strike ? Pose.SlimeHurt : Pose.SlimeIdle);
        if (strike) this.hit(this.slimeArt, strike);
        if (interrupted) this.floatText('打断！', 0, 54, new Color(255, 213, 93));

        const sequence = tween(this.effects);
        if (counter) sequence.delay(presentation.counterDelay).call(() => {
            this.pose(this.heroArt, Pose.HeroHurt);
            this.hit(this.heroArt, counter.damage, heavy);
            if (heavy) {
                this.pose(this.slimeArt, Pose.SlimeHeavy);
                this.redFlash.opacity = presentation.redOpacity;
                tween(this.redFlash).to(presentation.flashTime, { opacity: 0 }).start();
                tween(this.ui).to(presentation.kickTime, { position: new Vec3(presentation.shake, 0) })
                    .to(presentation.kickTime, { position: new Vec3(-presentation.shake, 0) })
                    .to(presentation.kickTime, { position: new Vec3() }).start();
            }
            if (result.state.slimeCharging) {
                this.pose(this.slimeArt, Pose.SlimeCharge);
                this.pulse(this.slimeArt.sprite.node, presentation.chargeScale, presentation.chargeBreath);
            }
        });
        const outcome = battleOutcome(result.state);
        sequence.delay(presentation.poseTime).call(() => {
            if (outcome) {
                this.showOutcome(outcome);
                this.render();
                return;
            }
            this.pose(this.heroArt, Pose.HeroIdle);
            if (!interrupted && !result.state.slimeCharging) this.pose(this.slimeArt, Pose.SlimeIdle);
        });

        const hitTime = Math.max(presentation.floatTime, presentation.flashTime,
            presentation.kickTime + presentation.returnTime, counter && heavy ? 3 * presentation.kickTime : 0);
        const remainingHitTime = Math.max(0, hitTime - presentation.poseTime);
        const remainingTime = outcome
            ? Math.max(remainingHitTime, presentation.resultDelay, presentation.fallTime + presentation.fadeTime)
            : remainingHitTime;
        sequence.delay(remainingTime).call(() => {
            this.locked = false;
            this.render();
        }).start();
    }

    private showOutcome(outcome: 'victory' | 'defeat') {
        if (outcome === 'defeat') {
            this.pose(this.slimeArt, Pose.SlimeIdle);
            this.pose(this.heroArt, Pose.HeroHurt);
            const shade = Math.round(255 * presentation.heroBrightness);
            this.heroArt.sprite.color = new Color(shade, shade, shade);
            tween(this.heroArt.sprite.node).to(presentation.fallTime, {
                angle: presentation.heroFallAngle,
                position: new Vec3(this.heroArt.x, presentation.actorY - presentation.heroSink),
            }).start();
            this.messages.push('战败！勇者倒下了。');
            return;
        }

        this.pose(this.heroArt, Pose.HeroIdle);
        this.pose(this.slimeArt, Pose.SlimeStunned);
        tween(this.slimeArt.sprite.node).to(presentation.fallTime, {
            scale: new Vec3(1, presentation.slimeSquash, 1),
            position: new Vec3(this.slimeArt.x, presentation.actorY - presentation.slimeSink),
        }).start();
        tween(this.slimeArt.opacity).delay(presentation.fallTime)
            .to(presentation.fadeTime, { opacity: Math.round(255 * presentation.slimeOpacity) }).start();
        this.messages.push(runStatus(this.run) === 'cleared' ? '通关！' : '胜利！勇者击败了史莱姆。');
    }

    private pulse(node: Node, scale: number, amplitude: number) {
        node.setScale(scale, scale, 1);
        tween(node).repeatForever(tween<Node>()
            .to(presentation.pulseTime, { scale: new Vec3(scale + amplitude, scale + amplitude, 1) })
            .to(presentation.pulseTime, { scale: new Vec3(scale, scale, 1) })).start();
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
        const node = this.panel(this.ui, text, x, -415, 216, 96, buttonColor);
        node.addComponent(UIOpacity);
        const button = node.addComponent(Button);
        button.target = node;
        this.label(node, 'Caption', text, 0, 0, 36);
        node.on(Button.EventType.CLICK, click, this);
        return button;
    }
}
