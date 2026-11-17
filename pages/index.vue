<script setup lang="ts">

import { useAuth } from '~/composables/useAuth'

useHead({
  title: '食鉴 · 菜单到手，先知道哪道别点',
  meta: [
    {
      name: 'description',
      content: '把你的情况说一遍，之后拍菜单、挑城市，我逐道告诉你哪几道得让开，以及凭什么。'
    }
  ]
})

const scrolled = ref(false)
const hidden = ref(false)


const { user, sync } = useAuth()


let ticking = false
let lastY = 0

function applyScroll() {
  ticking = false
  const y = window.scrollY

  const nextSolid = y > 120
  if (nextSolid !== scrolled.value) scrolled.value = nextSolid



  const nextHidden = y > lastY + 4 && y > 150
  if (nextHidden !== hidden.value) hidden.value = nextHidden
  lastY = y
}

function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(applyScroll)
}

onMounted(() => {
  sync()
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <div class="page">

    <nav class="nav" :class="{ 'is-solid': scrolled, 'is-hidden': hidden }">
      <div class="wrap nav__inner">
        <NuxtLink to="/" class="brand">
          <span class="brand__cn">食鉴</span>
          <span class="brand__en">Shijian</span>
        </NuxtLink>

        <div class="nav__links">
          <NuxtLink to="/cities">找地方菜</NuxtLink>
          <NuxtLink to="/chat">问食鉴</NuxtLink>
          <NuxtLink to="/favorites">我的</NuxtLink>
          <NuxtLink to="/profile">你的情况</NuxtLink>
          <NuxtLink v-if="!user" to="/login">登录</NuxtLink>
        </div>

        <NuxtLink to="/scan" class="nav__cta">
          <span>拍菜单</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" /></svg>
        </NuxtLink>
      </div>
    </nav>


    <header id="top" class="hero">
      <img
        class="hero__bg"
        src="/hero-table.jpg"
        alt="深色台面上摊满面粉、鸡蛋、奶酪、番茄与香料，中间留出空位"
        fetchpriority="high"
      />
      <div class="hero__veil" aria-hidden="true"></div>

      <div class="wrap hero__inner">
        <h1 class="hero__title">食鉴</h1>

        <div class="hero__act">
          <NuxtLink to="/scan" class="btn-solid">拍张菜单看看</NuxtLink>
          <NuxtLink to="/cities" class="txt-link txt-link--light">
            或者按城市挑
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" /></svg>
          </NuxtLink>
        </div>
      </div>

      <div class="wrap hero__foot">
        <span class="stat"><b>250</b> 道菜</span>
        <span class="sep" aria-hidden="true"></span>
        <span class="stat"><b>30</b> 座城</span>
        <span class="sep" aria-hidden="true"></span>
        <span class="stat"><b>12</b> 类过敏原</span>
      </div>
    </header>

    <main>

      <section id="verdict" class="sec verdict">
        <div class="wrap">
          <div class="sec-head">
            <div class="titles">
              <span class="sec-no">壹 · WHY</span>
              <h2 class="sec-title">点评管你去哪家，<br />没人管你吃哪道。</h2>
            </div>

            <p class="sec-lede">
              菜单八道菜，你只操心一件事：哪几道不能碰。可现在全靠自己一勺一勺问——
              有虾皮吗？酱里搁花生没有？这锅汤熬了几个钟头？
            </p>
          </div>

          <div class="profile-bar">
            <span class="pb-t">当前情况</span>
            <ul>
              <li>女 · <b>28</b> 岁</li>
              <li><b>165</b> cm / <b>54</b> kg</li>
              <li>中度活动</li>
              <li>目标 <b>减脂</b></li>
              <li>过敏 <b>花生 · 甲壳类</b></li>
              <li>慢病 <b>痛风</b></li>
            </ul>
          </div>

          <div class="cards">
            <article class="card card--safe">
              <div class="card-head">
                <span class="stamp stamp--forest">可以吃</span>
                <span class="card-no">No. 01</span>
              </div>
              <h3>清蒸武昌鱼</h3>
              <p class="card-meta">武汉 · 楚菜 · ¥88 · 蒸 · 咸鲜</p>
              <ul class="chips">
                <li>武昌鱼</li><li>姜</li><li>小葱</li><li>蒸鱼豉油</li><li>红椒丝</li>
              </ul>
              <div class="card-hit">
                <span class="h-t">判定</span>
                <p>四道关，一道都没撞上：过敏不沾，痛风不犯，蒸法也不在减脂要躲的那几样里。</p>
                <p class="cite">依据 · 四条规矩：过敏 / 孕期 / 慢病 / 目标</p>
              </div>
              <p class="card-foot">唯一得留神的是豉油里的钠——够不上改判，痛风的人少蘸两下。</p>
            </article>

            <article class="card card--caution">
              <div class="card-head">
                <span class="stamp stamp--olive">注意</span>
                <span class="card-no">No. 02</span>
              </div>
              <h3>东坡肉</h3>
              <p class="card-meta">杭州 · 杭帮菜 · ¥48 · 焖 · 咸甜</p>
              <ul class="chips">
                <li>五花肉</li><li>黄酒</li><li>冰糖</li><li>生抽</li><li>老抽</li>
              </ul>
              <div class="card-hit">
                <span class="h-t">撞上 1 条</span>
                <p class="q">五花肉，油重。减脂这阵子，筷子收着点</p>
                <p class="cite">依据 · 减脂那一栏</p>
              </div>
              <p class="card-foot">
                能吃，份量收一收，或者配两道清淡的。另外黄酒算酒精——
                你要是连酒也忌，这道当场变「别点」。
              </p>
            </article>

            <article class="card card--forbidden">
              <div class="card-head">
                <span class="stamp stamp--brick">别点</span>
                <span class="card-no">No. 03</span>
              </div>
              <h3>口味虾</h3>
              <p class="card-meta">长沙 · 湘菜 · ¥128 · 爆炒 · 特辣</p>
              <ul class="chips">
                <li>小龙虾</li><li>干辣椒</li><li>花椒</li><li>姜</li><li>蒜</li><li>紫苏</li>
              </ul>
              <div class="card-hit">
                <span class="h-t">撞上 1 条 · 最要紧的那种</span>
                <p class="q">甲壳类，正好压在你的过敏原上</p>
                <p class="cite">依据 · 八大类过敏原清单</p>
              </div>
              <p class="card-foot">换一道，或者问问能不能不放。过敏这条，没得商量<sup>1</sup>。</p>
            </article>
          </div>

          <div class="summary">
            <span class="s-lb">整桌汇总</span>
            <span class="s-bar">
              <i><span class="dot dot--safe"></span>安全 5 道</i>
              <i><span class="dot dot--caution"></span>注意 2 道</i>
              <i><span class="dot dot--forbidden"></span>别点 1 道</i>
            </span>
            <span class="s-ok">一共 8 道</span>
          </div>

          <div class="footnotes">
            <b>1</b> 过敏原词表以 GB 7718-2011《预包装食品标签通则》附录 C 的八大类为底，另加贝类、芝麻、酒精、亚硫酸盐。<br />
            <b>2</b> 中餐的过敏原多半藏在调料罐里：酱油有大豆和小麦，蚝油有贝类，虾皮是甲壳类，鱼露是鱼类，还有花生油和挂糊的蛋液。所以问「放了什么调料」比问「这道菜有什么」管用。
          </div>
        </div>
      </section>


      <section id="city" class="city">
        <div class="wrap city-grid">
          <div>
            <span class="sec-no">贰 · CITIES</span>
            <h2 class="sec-title city-title">不想拍照？<br />先挑你要去的那座城。</h2>
            <p class="city-lead">
              30 座城、250 道代表菜，一道一道都提前过过筛子。挑一座，哪几道跟你犯冲，
              落座前就看得见——不用等上菜，也不用追着服务员问。
            </p>

            <ul class="city-list">
              <li>成都 <span>川菜 · 9 道</span></li>
              <li>潮州 <span>潮州菜 · 9 道</span></li>
              <li>西安 <span>陕菜 · 9 道</span></li>
              <li>宁波 <span>甬帮菜 · 8 道</span></li>
              <li>佛山 <span>粤菜 · 9 道</span></li>
              <li>乌鲁木齐 <span>新疆菜 · 8 道</span></li>
            </ul>

            <div class="city-acts">
              <NuxtLink to="/cities" class="btn-solid">
                挑一座城
                <span aria-hidden="true">→</span>
              </NuxtLink>
              <span class="stamp stamp--ghost-cream">共 30 城 · 250 道</span>
            </div>
          </div>
        </div>
      </section>

    </main>


    <footer class="foot">
      <div class="wrap">
        <div class="foot__grid">
          <div class="foot__brand">
            <p class="foot__cn">食鉴</p>
            <span class="foot__en">Shijian &middot; 看得懂菜单的 AI</span>
          </div>
        </div>

        <div class="foot__bot">
          <span>菜单到手，先知道哪道别点</span>
          <a class="top" href="#top">
            回到顶部
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
          </a>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>

.page {

  --serif-lit: 'Han Serif', Georgia, 'Songti SC', SimSun, serif;
  --sans-lit: var(--sans);

  --sec: clamp(84px, 9vw, 148px);
  --pad-x: clamp(22px, 4vw, 44px);

  background: var(--cream);
  overflow-x: hidden;
}

.wrap {
  width: 100%;
  max-width: var(--max);
  margin: 0 auto;
  padding-left: var(--pad-x);
  padding-right: var(--pad-x);
}

section[id],
header[id] {
  scroll-margin-top: 72px;
}










.sec-title {
  font-family: var(--serif-lit);
  font-weight: 900;
  font-size: 40px;
  line-height: 1.46;
  letter-spacing: 0.03em;
  color: var(--ink);
}

.sec-title .accent {
  color: var(--sepia);
}

.sec {
  padding-top: var(--sec);
  padding-bottom: var(--sec);
}

.sec__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: clamp(26px, 5vw, 60px);
  margin-bottom: clamp(38px, 5vw, 64px);
}

.sec__head .titles {
  max-width: 600px;
}



.nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 60;
  border-bottom: 1px solid transparent;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease),
    transform 300ms ease-in-out, opacity 300ms ease-in-out;

  will-change: transform;
}


.nav.is-hidden {
  transform: translateY(-100%);
  opacity: 0;
}

.nav__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
  padding-top: 24px;
  padding-bottom: 24px;
  transition: padding var(--dur) var(--ease);
}


.nav.is-solid {
  background: var(--cream);
  border-bottom-color: var(--line);
}

.nav.is-solid .brand__cn {
  color: var(--sepia);
}

.nav.is-solid .brand__en {
  color: var(--muted);
}

.nav.is-solid .nav__links a {
  color: var(--muted);
}

.nav.is-solid .nav__links a:hover {
  color: var(--sepia);
}

.nav.is-solid .nav__cta {
  border-color: var(--line-strong);
  color: var(--sepia);
}

.nav.is-solid .nav__cta:hover {
  background: var(--sepia);
  border-color: var(--sepia);
  color: var(--cream);
}

.nav.is-solid .nav__inner {
  padding-top: 14px;
  padding-bottom: 14px;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
  line-height: 1;
}


.brand__cn {
  font-family: var(--serif-lit);
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 0.18em;
  color: var(--cream);
}


.brand__en {
  font-family: var(--sans-lit);
  font-size: 12px;
  font-style: italic;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: rgba(245, 230, 211, 0.7);
  opacity: 0.75;
}

.nav__links {
  display: flex;
  align-items: center;
  gap: clamp(18px, 3vw, 42px);
}

.nav__links a {
  position: relative;
  font-size: 12px;
  letter-spacing: 0.2em;
  color: rgba(245, 230, 211, 0.78);
  padding-bottom: 4px;
  transition: color var(--dur) var(--ease);
}

.nav__links a::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 1px;
  background: currentColor;

  transform: scaleX(0);
  transform-origin: right;
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.nav__links a:hover {
  color: var(--cream);
}

.nav__links a:hover::after {
  transform: scaleX(1);
  transform-origin: left;
}

@media (prefers-reduced-motion: reduce) {
  .nav__links a::after {
    transition: none;
  }


  .nav.is-hidden {
    transform: none;
    opacity: 1;
  }
}

.nav__cta {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 10px 20px;
  border: 1px solid rgba(245, 230, 211, 0.4);
  border-radius: var(--radius);
  font-size: 12px;
  letter-spacing: 0.22em;
  color: var(--cream);
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease), color var(--dur) var(--ease);
}

.nav__cta svg {
  width: 11px;
  height: 11px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.nav__cta:hover {
  background: var(--cream);
  border-color: var(--cream);
  color: var(--ink);
}



.hero {
  position: relative;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #2b2521;
}

.hero__bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}



.hero__veil {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: rgba(61, 36, 16, 0.34);
}

.hero__inner {
  position: relative;
  z-index: 2;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding-top: clamp(104px, 14vh, 150px);
  padding-bottom: clamp(22px, 3vw, 38px);
  color: var(--cream);
}



.hero__title {
  font-family: var(--serif-lit);
  font-weight: 900;
  font-size: clamp(52px, 7.5vw, 76px);
  line-height: 1.1;
  letter-spacing: 0.08em;
  text-indent: 0.08em;
  color: var(--cream);
  margin: clamp(16px, 2.2vw, 28px) 0 0;
}

.hero__act {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-top: clamp(26px, 3.2vw, 40px);
  flex-wrap: wrap;
}



.txt-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  letter-spacing: 0.16em;
  color: var(--muted);
  border-bottom: 1px solid var(--line-strong);
  padding-bottom: 4px;
  transition: color var(--dur) var(--ease), border-color var(--dur) var(--ease);
}

.txt-link svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform var(--dur) var(--ease);
}

.txt-link:hover {
  color: var(--sepia);
  border-color: var(--sepia);
}

.txt-link:hover svg {
  transform: translateX(3px);
}

.txt-link--sm {
  font-size: 12px;
}


.frame {
  position: relative;
  margin: 0;
  border: 2px solid var(--sepia);
  border-radius: var(--radius);
  padding: 10px;
  background: var(--lifted);
}

.frame img {
  width: 100%;
  aspect-ratio: 5 / 6;
  object-fit: cover;
  filter: sepia(0.32) saturate(0.72) contrast(0.98);
  border: 1px solid var(--line);
  display: block;
}

.frame figcaption {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  font-size: 12px;
  letter-spacing: 0.1em;
  color: var(--muted);
}

.frame figcaption .cn {
  font-weight: 500;
  color: var(--ink);
}

.hero__foot {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: clamp(16px, 2.6vw, 36px);
  padding-top: 18px;
  padding-bottom: 24px;
  border-top: 1px solid rgba(245, 230, 211, 0.22);
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(245, 230, 211, 0.6);
}

.hero__foot .stat {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}


.hero__foot .stat b {
  font-family: var(--serif-lit);
  font-weight: 900;
  font-size: 15px;
  letter-spacing: 0.04em;
  color: var(--cream);
}

.hero__foot .sep {
  width: 1px;
  height: 10px;
  background: rgba(245, 230, 211, 0.28);
}



.stamp {
  display: inline-block;
  padding: 4px 12px;
  border-radius: var(--radius);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.16em;
  color: var(--cream);
  background: var(--sepia);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
  line-height: 1.5;
  white-space: nowrap;
}

.stamp--forest {
  background: var(--forest);
}

.stamp--brick {
  background: var(--brick);
}

.stamp--olive {
  background: var(--olive);
}

.stamp--ghost-cream {
  background: transparent;
  color: var(--cream);
  box-shadow: none;
  border: 2px solid rgba(245, 230, 211, 0.45);
}



.sec-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: clamp(28px, 4vw, 64px);
  margin-bottom: clamp(40px, 4.5vw, 64px);
}

.sec-head .titles {
  max-width: 640px;
}

.sec-no {
  font-family: var(--serif-lit);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.3em;
  color: var(--olive);
  display: block;
  margin-bottom: 14px;
}




.sec-lede {
  flex: 1;
  max-width: 34em;
  font-size: 18px;
  line-height: 1.9;
  color: var(--ink);
}



.verdict {
  background: var(--lifted);
  border-top: 2px solid var(--line-strong);
  border-bottom: 2px solid var(--line-strong);
}

.profile-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  border: 2px solid var(--line);
  border-radius: var(--radius);
  padding: 14px 20px;
  margin-bottom: 32px;
  background: var(--cream);
}

.profile-bar .pb-t {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.16em;
  color: var(--sepia);
  border-right: 1px solid var(--line);
  padding-right: 16px;
}

.profile-bar ul {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  font-size: 13px;
  color: var(--muted);
  letter-spacing: 0.04em;
  list-style: none;
  margin: 0;
  padding: 0;
}

.profile-bar li b {
  font-weight: 500;
  color: var(--ink);
}

.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.cards .card {
  background: var(--cream);
  border: 2px solid var(--line);
  border-top-width: 6px;
  border-radius: var(--radius);
  padding: 24px;
  display: flex;
  flex-direction: column;
  transition: border-color var(--dur) var(--ease);
}

.cards .card--safe {
  border-top-color: var(--forest);
}

.cards .card--caution {
  border-top-color: var(--olive);
}

.cards .card--forbidden {
  border-top-color: var(--brick);
}

.cards .card:hover {
  border-color: var(--line-strong);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.card-no {
  font-family: Georgia, serif;
  font-style: italic;
  font-size: 13px;
  color: var(--muted);
}

.cards .card h3 {
  font-family: var(--serif-lit);
  font-weight: 700;
  font-size: 22px;
  letter-spacing: 0.05em;
  line-height: 1.35;
  color: var(--sepia-deep);
}

.card-meta {
  margin-top: 6px;
  font-size: 12px;
  letter-spacing: 0.1em;
  color: var(--muted);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}

.chips li {
  font-size: 12px;
  line-height: 1.6;
  letter-spacing: 0.06em;
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 3px 8px;
  background: var(--lifted);
}

.card-hit {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px dashed var(--line-strong);
  flex: 1;
}

.card-hit .h-t {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.18em;
  color: var(--muted);
  display: block;
  margin-bottom: 6px;
}

.card-hit p {
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--ink);
}

.card-hit p.q {
  color: var(--sepia-deep);
}

.card-hit .cite {
  margin-top: 12px;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--muted);
  letter-spacing: 0.04em;
}

.card-hit .cite b {
  font-weight: 500;
  color: var(--sepia);
}

.card-foot {
  margin-top: 16px;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--muted);
  border-top: 1px solid var(--line);
  padding-top: 12px;
}

.summary {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: clamp(16px, 3vw, 32px);
  margin-top: 20px;
  border: 2px solid var(--line-strong);
  border-radius: var(--radius);
  padding: 18px 24px;
  background: var(--cream);
}

.summary .s-lb {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.18em;
  color: var(--sepia);
}

.summary .s-bar {
  display: flex;
  align-items: center;
  gap: 22px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--muted);
  letter-spacing: 0.06em;
}

.summary .s-bar i {
  font-style: normal;
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.verdict .dot {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  display: inline-block;
}

.verdict .dot--safe {
  background: var(--forest);
}

.verdict .dot--caution {
  background: var(--olive);
}

.verdict .dot--forbidden {
  background: var(--brick);
}

.summary .s-ok {
  font-family: var(--serif-lit);
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.06em;
  color: var(--forest);
}

.footnotes {
  margin-top: 28px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
  font-size: 11.5px;
  line-height: 1.9;
  color: var(--muted);
  letter-spacing: 0.02em;
}

.footnotes b {
  font-weight: 500;
  color: var(--sepia);
}

.verdict sup {
  font-size: 0.7em;
  vertical-align: super;
  color: var(--brick);
  padding-left: 1px;
}



.city {
  background: var(--forest);
  color: var(--cream);
  border-top: 2px solid var(--sepia-deep);
  border-bottom: 2px solid var(--sepia-deep);
  padding-top: clamp(64px, 7vw, 88px);
  padding-bottom: clamp(64px, 7vw, 88px);
}

.city-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: clamp(32px, 5vw, 64px);
  align-items: center;
}


.city-grid > div {
  max-width: 780px;
}

.city .sec-no {
  color: var(--sand);
}

.city-title {
  color: var(--cream);
}

.city-lead {
  margin-top: 20px;
  font-size: 17px;
  line-height: 1.8;
  color: rgba(245, 230, 211, 0.78);
  max-width: 30em;
}

.city-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 24px;
  margin: 32px 0 0;
  padding: 20px 0 0;
  border-top: 1px solid rgba(245, 230, 211, 0.25);
  list-style: none;
}

.city-list li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 13.5px;
  letter-spacing: 0.08em;
  color: rgba(245, 230, 211, 0.9);
  padding: 7px 0;
  border-bottom: 1px solid rgba(245, 230, 211, 0.12);
}

.city-list li span {
  font-size: 11.5px;
  color: rgba(245, 230, 211, 0.5);
  letter-spacing: 0.1em;
}

.city-acts {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 30px;
  flex-wrap: wrap;
}



.btn-solid {
  display: inline-flex;
  align-items: center;
  padding: 14px 32px;
  border-radius: var(--radius);
  background: var(--cream);
  color: var(--ink);
  font-size: 12px;
  letter-spacing: 0.2em;
  transition: background var(--dur) var(--ease);
}

.btn-solid:hover {
  background: var(--sand);
}

.txt-link--light {
  color: rgba(245, 230, 211, 0.65);
  border-color: rgba(245, 230, 211, 0.28);
}

.txt-link--light:hover {
  color: var(--cream);
  border-color: var(--cream);
}



.foot {
  background: var(--lifted);
  border-top: 1px solid var(--line);
  padding-top: clamp(48px, 5.5vw, 72px);
  padding-bottom: 28px;
}

.foot__grid {
  display: grid;
  grid-template-columns: 1fr;
  max-width: 46em;
  padding-bottom: clamp(34px, 4.5vw, 52px);
  border-bottom: 1px solid var(--line);
}


.foot__cn {
  font-family: var(--serif-lit);
  font-weight: 900;
  font-size: 22px;
  letter-spacing: 0.18em;
  color: var(--sepia);
}


.foot__en {
  display: block;
  margin-top: 6px;
  font-family: var(--sans-lit);
  font-style: italic;
  font-size: 12px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--muted);
  opacity: 0.8;
}

.foot__bot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding-top: 22px;
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}

.top {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.top svg {
  width: 10px;
  height: 10px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform var(--dur) var(--ease);
}



@media (max-width: 1100px) {
  .cards {
    grid-template-columns: repeat(2, 1fr);
  }

  .cards .card:last-child {
    grid-column: span 2;
  }
}

@media (prefers-reduced-motion: reduce) {
  .card {
    transition: none;
  }
}
</style>
