import { FormEvent, useEffect, useMemo, useState } from "react";
import "./styles.css";

/* ---------------- 类型 ---------------- */

interface DamageArea {
  id: string;
  name: string;
  size: string;
  note: string;
}

interface ColorCard {
  id: string;
  code: string; // 色号
  name: string;
  hex: string;
  stock: number; // 库存（克）
}

interface Trial {
  id: string;
  formula: string; // 配方
  code: string; // 色号
  result: "成功" | "失败";
  time: string;
}

interface Step {
  id: string;
  name: string;
  done: boolean;
}

interface RugRecord {
  id: string;
  origin: string;
  era: string;
  knotDensity: string;
  material: string;
  dyeType: string;
  damageAreas: DamageArea[];
  colorCards: ColorCard[];
  trials: Trial[];
  currentTrialId: string | null; // 当前方案 = 某次成功试色
  steps: Step[];
}

/* ---------------- 常量与种子数据 ---------------- */

const STORAGE_KEY = "carpet-repair-archive-v1";

const ORIGINS = ["波斯", "安纳托利亚", "高加索", "藏毯"];

const DEFAULT_STEP_NAMES = ["清理创面", "配线试色", "补线织造", "做旧处理", "平整验收"];

const uid = () => Math.random().toString(36).slice(2, 10);

const nowText = () => new Date().toLocaleString("zh-CN", { hour12: false });

function makeSteps(doneCount: number, names: string[] = DEFAULT_STEP_NAMES): Step[] {
  return names.map((name, i) => ({ id: uid(), name, done: i < doneCount }));
}

function seedRecords(): RugRecord[] {
  const t1 = { id: uid(), formula: "枣红 3 : 米白 1 拼色", code: "P-101", result: "成功" as const, time: "2026/9/10 10:24:00" };
  const t2 = { id: uid(), formula: "靛蓝直染加深两遍", code: "P-205", result: "失败" as const, time: "2026/9/11 15:02:00" };
  const t3 = { id: uid(), formula: "赭石 2 : 茜草红 1", code: "A-110", result: "成功" as const, time: "2026/9/12 09:40:00" };
  return [
    {
      id: "CAR-092",
      origin: "波斯",
      era: "约1960s",
      knotDensity: "36 结/厘米",
      material: "羊毛",
      dyeType: "植物染",
      damageAreas: [{ id: uid(), name: "边缘磨损", size: "约 12cm 流苏边", note: "经线外露，需补线" }],
      colorCards: [
        { id: uid(), code: "P-101", name: "枣红", hex: "#7c2d12", stock: 120 },
        { id: uid(), code: "P-205", name: "靛蓝", hex: "#1e3a8a", stock: 0 },
        { id: uid(), code: "P-330", name: "米白", hex: "#e7e5e4", stock: 200 },
      ],
      trials: [t1, t2],
      currentTrialId: t1.id,
      steps: makeSteps(2),
    },
    {
      id: "CAR-117",
      origin: "安纳托利亚",
      era: "约1940s",
      knotDensity: "42 结/厘米",
      material: "羊毛",
      dyeType: "植物染",
      damageAreas: [{ id: uid(), name: "中心纹样缺口", size: "掌心大小", note: "主花缺瓣" }],
      colorCards: [
        { id: uid(), code: "A-110", name: "赭石", hex: "#b45309", stock: 80 },
        { id: uid(), code: "A-114", name: "茜草红", hex: "#9f1239", stock: 45 },
      ],
      trials: [t3],
      currentTrialId: null,
      steps: makeSteps(1),
    },
    {
      id: "CAR-138",
      origin: "藏毯",
      era: "约1980s",
      knotDensity: "30 结/厘米",
      material: "牦牛毛",
      dyeType: "矿物染",
      damageAreas: [{ id: uid(), name: "局部褪色", size: "约 20cm²", note: "需匹配靛蓝色卡" }],
      colorCards: [],
      trials: [],
      currentTrialId: null,
      steps: makeSteps(0),
    },
    {
      id: "CAR-150",
      origin: "高加索",
      era: "约1970s",
      knotDensity: "33 结/厘米",
      material: "羊毛",
      dyeType: "植物染",
      damageAreas: [],
      colorCards: [{ id: uid(), code: "C-208", name: "茜草红", hex: "#9f1239", stock: 60 }],
      trials: [],
      currentTrialId: null,
      steps: makeSteps(0),
    },
  ];
}

function loadRecords(): RugRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    /* 数据损坏时回退到种子数据 */
  }
  return seedRecords();
}

/* ---------------- 小组件 ---------------- */

function Badge({ tone, children }: { tone: "ok" | "fail" | "wait" | "next"; children: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/* ---------------- 主应用 ---------------- */

function App() {
  const [records, setRecords] = useState<RugRecord[]>(loadRecords);
  const [selectedId, setSelectedId] = useState<string>(() => loadRecords()[0]?.id ?? "");
  const [filter, setFilter] = useState<string>("全部");
  // 切换方案失败时的缺失项（按档案 id 记录），成功或变更后清空
  const [switchIssues, setSwitchIssues] = useState<Record<string, string[]>>({});

  // 刷新后全部状态仍在：任何变更都写回 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const updateRecord = (id: string, updater: (r: RugRecord) => RugRecord) => {
    setRecords((prev) => prev.map((r) => (r.id === id ? updater(r) : r)));
  };

  const filtered = useMemo(
    () => (filter === "全部" ? records : records.filter((r) => r.origin === filter)),
    [records, filter]
  );

  const selected = records.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  const metrics = useMemo(() => {
    const totalSteps = records.reduce((n, r) => n + r.steps.length, 0);
    const doneSteps = records.reduce((n, r) => n + r.steps.filter((s) => s.done).length, 0);
    return [
      { label: "待修复", value: records.filter((r) => r.steps.some((s) => !s.done)).length },
      { label: "纹样档案", value: records.length },
      { label: "色卡数量", value: records.reduce((n, r) => n + r.colorCards.length, 0) },
      { label: "完工率", value: totalSteps ? Math.round((doneSteps / totalSteps) * 100) + "%" : "0%" },
    ];
  }, [records]);

  /* ---------- 档案级操作 ---------- */

  const addRecord = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const id = String(fd.get("id") || "").trim() || `CAR-${Date.now() % 1000}`;
    if (records.some((r) => r.id === id)) return;
    const rec: RugRecord = {
      id,
      origin: String(fd.get("origin") || ORIGINS[0]),
      era: String(fd.get("era") || ""),
      knotDensity: String(fd.get("knotDensity") || ""),
      material: String(fd.get("material") || ""),
      dyeType: String(fd.get("dyeType") || ""),
      damageAreas: [],
      colorCards: [],
      trials: [],
      currentTrialId: null,
      steps: makeSteps(0),
    };
    setRecords((prev) => [...prev, rec]);
    setSelectedId(id);
    e.currentTarget.reset();
  };

  const exportCsv = () => {
    const header = "档案号,产地,年代,结密度,材质,染色类型,破损区域数,色卡数,试色次数,当前方案,工序进度";
    const lines = records.map((r) => {
      const plan = r.trials.find((t) => t.id === r.currentTrialId);
      const done = r.steps.filter((s) => s.done).length;
      return [
        r.id, r.origin, r.era, r.knotDensity, r.material, r.dyeType,
        r.damageAreas.length, r.colorCards.length, r.trials.length,
        plan ? `${plan.code}（${plan.formula}）` : "未定",
        `${done}/${r.steps.length}`,
      ].join(",");
    });
    const blob = new Blob(["﻿" + header + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "地毯修复档案.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /* ---------- 详情操作 ---------- */

  const addDamage = (rec: RugRecord) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    if (!name) return;
    const area: DamageArea = {
      id: uid(),
      name,
      size: String(fd.get("size") || "").trim(),
      note: String(fd.get("note") || "").trim(),
    };
    updateRecord(rec.id, (r) => ({ ...r, damageAreas: [...r.damageAreas, area] }));
    e.currentTarget.reset();
  };

  const addCard = (rec: RugRecord) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const code = String(fd.get("code") || "").trim();
    if (!code) return;
    const card: ColorCard = {
      id: uid(),
      code,
      name: String(fd.get("cardName") || "").trim() || code,
      hex: String(fd.get("hex") || "#7c2d12"),
      stock: Math.max(0, Number(fd.get("stock")) || 0),
    };
    updateRecord(rec.id, (r) => ({ ...r, colorCards: [...r.colorCards, card] }));
    e.currentTarget.reset();
  };

  const addTrial = (rec: RugRecord) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const formula = String(fd.get("formula") || "").trim();
    const code = String(fd.get("trialCode") || "").trim();
    if (!formula || !code) return;
    const trial: Trial = {
      id: uid(),
      formula,
      code,
      result: fd.get("result") === "失败" ? "失败" : "成功",
      time: nowText(),
    };
    // 失败配方留档但不占当前方案；成功配方也仅登记，需手动设为当前方案
    updateRecord(rec.id, (r) => ({ ...r, trials: [...r.trials, trial] }));
    e.currentTarget.reset();
  };

  // 切换当前方案：核对色卡一致性；缺料或色号不匹配时原方案与工序不变，并列出缺失项
  const switchPlan = (rec: RugRecord, trial: Trial) => {
    const issues: string[] = [];
    const card = rec.colorCards.find((c) => c.code === trial.code);
    if (!card) {
      issues.push(`色号 ${trial.code} 未在材料色卡中登记，无法核对一致性`);
    } else if (card.stock <= 0) {
      issues.push(`色卡 ${card.name}（${card.code}）缺料：库存 0 克，请先补料`);
    }
    if (issues.length > 0) {
      setSwitchIssues((prev) => ({ ...prev, [rec.id]: issues }));
      return; // 原方案与工序保持不变
    }
    setSwitchIssues((prev) => ({ ...prev, [rec.id]: [] }));
    updateRecord(rec.id, (r) => ({ ...r, currentTrialId: trial.id }));
  };

  // 工序只能按登记顺序推进：每次只完成排在最前的未完工工序
  const advanceStep = (rec: RugRecord) => {
    updateRecord(rec.id, (r) => {
      const idx = r.steps.findIndex((s) => !s.done);
      if (idx === -1) return r;
      return { ...r, steps: r.steps.map((s, i) => (i === idx ? { ...s, done: true } : s)) };
    });
  };

  // 回退到某道工序：撤销其后的全部进度，试色历史保留不动
  const rollbackTo = (rec: RugRecord, index: number) => {
    updateRecord(rec.id, (r) => ({
      ...r,
      steps: r.steps.map((s, i) => (i > index ? { ...s, done: false } : s)),
    }));
  };

  const addStep = (rec: RugRecord) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("stepName") || "").trim();
    if (!name) return;
    updateRecord(rec.id, (r) => ({ ...r, steps: [...r.steps, { id: uid(), name, done: false }] }));
    e.currentTarget.reset();
  };

  /* ---------------- 渲染 ---------------- */

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62009 · 源提示词2 · Port 62009</p>
        <h1>地毯修复纹样档案</h1>
        <span>
          登记破损区域与材料色卡后方可进入补线试色；每次试色记录配方、色号与结果，失败配方留档但不占当前方案；
          切换方案需核对色卡一致性，工序按登记顺序推进，回退仅撤销后续进度、保留试色历史。
        </span>
      </section>

      <section className="metrics">
        {metrics.map((m) => (
          <article key={m.label}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>

      <section className="workspace">
        <aside className="panel">
          <h2>产地筛选</h2>
          <div className="chips">
            {["全部", ...ORIGINS].map((o) => (
              <button
                key={o}
                className={filter === o ? "chip-active" : ""}
                onClick={() => setFilter(o)}
              >
                {o}
              </button>
            ))}
          </div>

          <div className="heading" style={{ marginTop: 20, marginBottom: 10 }}>
            <div>
              <p>档案列表</p>
              <h2>{filtered.length} 条</h2>
            </div>
            <button onClick={exportCsv}>导出CSV</button>
          </div>
          <div className="record-list">
            {filtered.map((r) => {
              const done = r.steps.filter((s) => s.done).length;
              return (
                <button
                  key={r.id}
                  className={`record-item ${selected?.id === r.id ? "record-active" : ""}`}
                  onClick={() => setSelectedId(r.id)}
                >
                  <b>{r.id}</b>
                  <span>
                    {r.origin} · {r.material} · 工序 {done}/{r.steps.length}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && <p className="muted">该产地暂无档案</p>}
          </div>
        </aside>

        {selected && (
          <section className="panel detail">
            <div className="heading">
              <div>
                <p>{selected.origin} · {selected.era}</p>
                <h2>{selected.id} 修复闭环</h2>
              </div>
              <div className="tags">
                <span>{selected.knotDensity}</span>
                <span>{selected.material}</span>
                <span>{selected.dyeType}</span>
              </div>
            </div>

            {/* 1. 破损区域登记 */}
            <section className="sub-panel">
              <h3>① 破损区域登记</h3>
              {selected.damageAreas.length === 0 && <p className="muted">尚未登记破损区域。</p>}
              <ul className="plain-list">
                {selected.damageAreas.map((d) => (
                  <li key={d.id}>
                    <b>{d.name}</b>
                    <span>{d.size}{d.note ? ` · ${d.note}` : ""}</span>
                  </li>
                ))}
              </ul>
              <form className="inline-form" onSubmit={addDamage(selected)}>
                <input name="name" placeholder="区域名称，如：边缘磨损" required />
                <input name="size" placeholder="范围尺寸" />
                <input name="note" placeholder="备注" />
                <button type="submit">登记区域</button>
              </form>
            </section>

            {/* 2. 材料色卡 */}
            <section className="sub-panel">
              <h3>② 材料色卡登记</h3>
              {selected.colorCards.length === 0 && <p className="muted">尚未登记色卡。</p>}
              <div className="card-grid">
                {selected.colorCards.map((c) => (
                  <div key={c.id} className="swatch-card">
                    <i style={{ background: c.hex }} />
                    <div>
                      <b>{c.code} · {c.name}</b>
                      <span className={c.stock > 0 ? "" : "stock-out"}>
                        库存 {c.stock} 克{c.stock <= 0 ? "（缺料）" : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <form className="inline-form" onSubmit={addCard(selected)}>
                <input name="code" placeholder="色号，如：P-101" required />
                <input name="cardName" placeholder="颜色名称" />
                <input name="hex" type="color" defaultValue="#7c2d12" title="色样" />
                <input name="stock" type="number" min="0" placeholder="库存(克)" />
                <button type="submit">登记色卡</button>
              </form>
            </section>

            {/* 3. 补线试色 */}
            <section className="sub-panel">
              <h3>③ 补线试色</h3>
              {(() => {
                const gates: string[] = [];
                if (selected.damageAreas.length === 0) gates.push("破损区域未登记");
                if (selected.colorCards.length === 0) gates.push("材料色卡未登记");
                const canTrial = gates.length === 0;
                return (
                  <>
                    {!canTrial && (
                      <p className="gate">进入试色前需完成登记：{gates.join("、")}。</p>
                    )}
                    <form className="inline-form" onSubmit={addTrial(selected)}>
                      <input name="formula" placeholder="配方，如：枣红 3 : 米白 1" required disabled={!canTrial} />
                      <input
                        name="trialCode"
                        placeholder="色号"
                        required
                        disabled={!canTrial}
                        list={`codes-${selected.id}`}
                      />
                      <datalist id={`codes-${selected.id}`}>
                        {selected.colorCards.map((c) => (
                          <option key={c.id} value={c.code} />
                        ))}
                      </datalist>
                      <select name="result" disabled={!canTrial}>
                        <option value="成功">成功</option>
                        <option value="失败">失败</option>
                      </select>
                      <button type="submit" disabled={!canTrial}>记录试色</button>
                    </form>
                  </>
                );
              })()}

              {selected.trials.length === 0 ? (
                <p className="muted">暂无试色记录。</p>
              ) : (
                <ul className="trial-list">
                  {selected.trials.map((t) => {
                    const isCurrent = t.id === selected.currentTrialId;
                    return (
                      <li key={t.id} className={t.result === "失败" ? "trial-failed" : ""}>
                        <div className="trial-main">
                          <b>{t.formula}</b>
                          <span>色号 {t.code} · {t.time}</span>
                        </div>
                        {t.result === "成功" ? <Badge tone="ok">成功</Badge> : <Badge tone="fail">失败·留档</Badge>}
                        {t.result === "成功" &&
                          (isCurrent ? (
                            <Badge tone="next">当前方案</Badge>
                          ) : (
                            <button className="mini" onClick={() => switchPlan(selected, t)}>
                              设为当前方案
                            </button>
                          ))}
                        {t.result === "失败" && <span className="muted small">失败配方留档，不占当前方案</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* 4. 当前方案 */}
            <section className="sub-panel">
              <h3>④ 当前方案</h3>
              {(() => {
                const plan = selected.trials.find((t) => t.id === selected.currentTrialId);
                const issues = switchIssues[selected.id] ?? [];
                return (
                  <>
                    {plan ? (
                      <p className="plan-line">
                        采用试色配方 <b>{plan.formula}</b>（色号 {plan.code}，{plan.time}）
                      </p>
                    ) : (
                      <p className="muted">尚未确定当前方案，请从成功试色中选择。</p>
                    )}
                    {issues.length > 0 && (
                      <div className="issues">
                        <b>切换未生效，原方案与工序保持不变。缺失项：</b>
                        <ul>
                          {issues.map((it) => (
                            <li key={it}>{it}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                );
              })()}
            </section>

            {/* 5. 工序进度 */}
            <section className="sub-panel">
              <div className="heading" style={{ marginBottom: 10 }}>
                <h3 style={{ margin: 0 }}>⑤ 工序进度</h3>
                <button
                  className="primary"
                  onClick={() => advanceStep(selected)}
                  disabled={selected.steps.every((s) => s.done)}
                >
                  推进下一工序
                </button>
              </div>
              <p className="muted small">工序只能按登记顺序推进；回退会撤销后续进度，但保留全部试色历史。</p>
              <ol className="steps">
                {selected.steps.map((s, i) => {
                  const isNext = !s.done && selected.steps.slice(0, i).every((x) => x.done);
                  return (
                    <li key={s.id} className={s.done ? "step-done" : isNext ? "step-next" : ""}>
                      <span className="step-idx">{i + 1}</span>
                      <b>{s.name}</b>
                      {s.done ? <Badge tone="ok">已完成</Badge> : isNext ? <Badge tone="next">下一工序</Badge> : <Badge tone="wait">待推进</Badge>}
                      {s.done && i < selected.steps.length - 1 && selected.steps.slice(i + 1).some((x) => x.done) && (
                        <button className="mini" onClick={() => rollbackTo(selected, i)}>
                          回退至此
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
              <form className="inline-form" onSubmit={addStep(selected)}>
                <input name="stepName" placeholder="追加工序名称（按登记顺序排列）" required />
                <button type="submit">登记工序</button>
              </form>
            </section>
          </section>
        )}
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>专业字段</p>
            <h2>新增档案</h2>
          </div>
        </div>
        <form className="field-grid" onSubmit={addRecord}>
          <label>
            <span>档案号</span>
            <input name="id" placeholder="如：CAR-160" />
          </label>
          <label>
            <span>地毯产地</span>
            <select name="origin">
              {ORIGINS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
          <label>
            <span>年代</span>
            <input name="era" placeholder="如：约1960s" />
          </label>
          <label>
            <span>结密度</span>
            <input name="knotDensity" placeholder="如：36 结/厘米" />
          </label>
          <label>
            <span>材质</span>
            <input name="material" placeholder="如：羊毛" />
          </label>
          <label>
            <span>染色类型</span>
            <input name="dyeType" placeholder="如：植物染" />
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <button className="primary" type="submit">保存档案</button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default App;
