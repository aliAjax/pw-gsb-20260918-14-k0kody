import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import "./styles.css";
import {
  STORAGE_KEY,
  canStartTesting,
  loadState,
  nowText,
  uid,
  validatePlanSwitch,
} from "./repair";
import type { ColorTest, RepairState, TestResult } from "./repair";

const project = {
  "sourceNo": 2,
  "id": "hxyfront-62009",
  "port": 62009,
  "title": "地毯修复纹样档案",
  "domain": "手工地毯修复",
  "prompt": "做一个给手工地毯修复工作室使用的纹样与修复档案前端项目，可以记录地毯产地、年代、结密度、材质、染色类型、破损区域、补线颜色和修复工序。页面需要有纹样局部标记图、修复前后记录、材料色卡、工序进度和按产地筛选的档案列表。",
  "palette": [
    "#7c2d12",
    "#b45309",
    "#0f766e"
  ],
  "metrics": [
    "待修复",
    "纹样档案",
    "色卡数量",
    "完工率"
  ],
  "filters": [
    "波斯",
    "安纳托利亚",
    "高加索",
    "藏毯"
  ],
  "fields": [
    "地毯产地",
    "年代",
    "结密度",
    "材质",
    "染色类型",
    "破损区域"
  ],
  "records": [
    [
      "CAR-092",
      "波斯",
      "羊毛，约1960s",
      "边缘磨损待补线"
    ],
    [
      "CAR-117",
      "安纳托利亚",
      "植物染，结密度42",
      "中心纹样缺口"
    ],
    [
      "CAR-138",
      "藏毯",
      "局部褪色",
      "需匹配靛蓝色卡"
    ]
  ]
};

function App() {
  const [state, setState] = useState<RepairState>(loadState);
  const [origin, setOrigin] = useState("全部");
  const [switchMissing, setSwitchMissing] = useState<string[]>([]);
  const [planNotice, setPlanNotice] = useState("");

  // 全部状态持久化，刷新后仍在
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const testUnlocked = canStartTesting(state);
  const currentPlan =
    state.tests.find((t) => t.id === state.currentPlanId) ?? null;
  const doneSteps = state.steps.filter((s) => s.done).length;
  const nextStepId = state.steps.find((s) => !s.done)?.id ?? null;

  const metricValues = [
    String(state.damages.length),
    String(project.records.length),
    String(state.colorCards.length),
    state.steps.length
      ? `${Math.round((doneSteps / state.steps.length) * 100)}%`
      : "—",
  ];

  const filteredRecords =
    origin === "全部"
      ? project.records
      : project.records.filter((r) => r[1] === origin);

  const addDamage = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const zone = String(fd.get("zone") ?? "").trim();
    if (!zone) return;
    setState((s) => ({
      ...s,
      damages: [
        ...s.damages,
        {
          id: uid(),
          zone,
          kind: String(fd.get("kind") ?? "").trim() || "磨损缺线",
          size: String(fd.get("size") ?? "").trim() || "未测量",
          createdAt: nowText(),
        },
      ],
    }));
    form.reset();
  };

  const addCard = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const code = String(fd.get("code") ?? "").trim();
    if (!code) return;
    setState((s) => ({
      ...s,
      colorCards: [
        ...s.colorCards,
        {
          id: uid(),
          code,
          name: String(fd.get("name") ?? "").trim(),
          hex: String(fd.get("hex") ?? "") || "#1d4ed8",
          stock: Math.max(0, Number(fd.get("stock")) || 0),
          createdAt: nowText(),
        },
      ],
    }));
    form.reset();
  };

  const addTest = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!testUnlocked) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const formula = String(fd.get("formula") ?? "").trim();
    const colorCode = String(fd.get("colorCode") ?? "").trim();
    if (!formula || !colorCode) return;
    const result: TestResult = fd.get("result") === "fail" ? "fail" : "success";
    setState((s) => ({
      ...s,
      tests: [
        ...s.tests,
        {
          id: uid(),
          formula,
          colorCode,
          amount: Math.max(1, Number(fd.get("amount")) || 1),
          result,
          note: String(fd.get("note") ?? "").trim(),
          createdAt: nowText(),
        },
      ],
    }));
    form.reset();
  };

  const switchPlan = (test: ColorTest) => {
    if (test.result !== "success") return;
    const missing = validatePlanSwitch(state, test);
    if (missing.length > 0) {
      // 缺料或色号不匹配：原方案与工序不变，仅列出缺失项
      setSwitchMissing(missing);
      setPlanNotice("");
      return;
    }
    setState((s) => ({ ...s, currentPlanId: test.id }));
    setSwitchMissing([]);
    setPlanNotice(
      `已切换当前方案：${test.formula}（色号 ${test.colorCode}，用量 ${test.amount} 绞）`,
    );
  };

  const completeStep = (stepId: string) => {
    setState((s) => {
      const idx = s.steps.findIndex((st) => st.id === stepId);
      if (idx < 0) return s;
      // 只能按登记顺序推进：前序工序必须全部完成
      if (s.steps.slice(0, idx).some((st) => !st.done)) return s;
      return {
        ...s,
        steps: s.steps.map((st, i) =>
          i === idx ? { ...st, done: true, doneAt: nowText() } : st,
        ),
      };
    });
  };

  const rollbackStep = (stepId: string) => {
    setState((s) => {
      const idx = s.steps.findIndex((st) => st.id === stepId);
      if (idx < 0) return s;
      // 回退撤销此步及后续进度；试色历史不受影响
      return {
        ...s,
        steps: s.steps.map((st, i) =>
          i >= idx ? { ...st, done: false, doneAt: null } : st,
        ),
      };
    });
  };

  const addStep = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("stepName") ?? "").trim();
    if (!name) return;
    setState((s) => ({
      ...s,
      steps: [
        ...s.steps,
        {
          id: uid(),
          name,
          detail: String(fd.get("stepDetail") ?? "").trim(),
          done: false,
          doneAt: null,
          createdAt: nowText(),
        },
      ],
    }));
    form.reset();
  };

  return (
    <main className="app">
      <section className="hero">
        <p>{project.id} · 源提示词{project.sourceNo} · Port {project.port}</p>
        <h1>{project.title}</h1>
        <span>{project.prompt}</span>
      </section>

      <section className="metrics">
        {project.metrics.map((metric: string, index: number) => (
          <article key={metric}>
            <small>{metric}</small>
            <strong>{metricValues[index] ?? "—"}</strong>
          </article>
        ))}
      </section>

      <section className="workspace">
        <aside className="panel">
          <h2>{project.domain}分类</h2>
          <div className="chips">
            {["全部", ...project.filters].map((item: string) => (
              <button
                key={item}
                className={origin === item ? "active" : ""}
                onClick={() => setOrigin(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </aside>

        <section className="panel form-panel">
          <div className="heading">
            <div>
              <p>专业字段</p>
              <h2>新增记录</h2>
            </div>
            <button className="primary">保存记录</button>
          </div>
          <div className="field-grid">
            {project.fields.map((field: string) => (
              <label key={field}>
                <span>{field}</span>
                <input placeholder={"填写" + field} />
              </label>
            ))}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>近期记录</p>
            <h2>工作台摘要{origin !== "全部" ? ` · ${origin}` : ""}</h2>
          </div>
          <button>导出CSV</button>
        </div>
        <div className="records">
          {filteredRecords.map((record: string[], index: number) => (
            <article key={record.join("-")}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <div>
                <h3>{record[0]}</h3>
                <p>{record.slice(1).join(" · ")}</p>
              </div>
            </article>
          ))}
          {filteredRecords.length === 0 && (
            <p className="empty-tip">该产地暂无档案记录</p>
          )}
        </div>
      </section>

      <section className="panel loop-panel">
        <div className="heading">
          <div>
            <p>补线试色与工序闭环</p>
            <h2>试色 · 方案 · 工序</h2>
          </div>
          <div className="plan-summary">
            当前方案：
            {currentPlan
              ? `${currentPlan.formula}（色号 ${currentPlan.colorCode}）`
              : "尚未确定"}
          </div>
        </div>

        {switchMissing.length > 0 && (
          <div className="missing-box">
            <b>方案切换被驳回：原方案与工序保持不变，缺失项如下</b>
            <ul>
              {switchMissing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        {planNotice && <div className="notice-box">{planNotice}</div>}

        <div className="loop-grid">
          <section className="sub-panel">
            <h3>破损区域登记</h3>
            <form className="mini-form" onSubmit={addDamage}>
              <input name="zone" placeholder="位置，如：边缘 / 中心纹样" required />
              <input name="kind" placeholder="破损类型，如：磨损缺线" />
              <input name="size" placeholder="范围，如：约 12cm" />
              <button className="primary" type="submit">登记破损区域</button>
            </form>
            <ul className="plain-list">
              {state.damages.map((d) => (
                <li key={d.id}>
                  <b>{d.zone}</b>
                  <span>{d.kind} · {d.size}</span>
                  <small>{d.createdAt}</small>
                </li>
              ))}
              {state.damages.length === 0 && (
                <li className="empty">尚未登记破损区域</li>
              )}
            </ul>
          </section>

          <section className="sub-panel">
            <h3>材料色卡登记</h3>
            <form className="mini-form" onSubmit={addCard}>
              <input name="code" placeholder="色号，如：IND-01" required />
              <input name="name" placeholder="名称，如：靛蓝" />
              <label className="color-field">
                <span>色样</span>
                <input type="color" name="hex" defaultValue="#1d4ed8" />
              </label>
              <input
                name="stock"
                type="number"
                min="0"
                placeholder="库存（绞）"
                defaultValue="1"
              />
              <button className="primary" type="submit">登记色卡</button>
            </form>
            <ul className="plain-list">
              {state.colorCards.map((c) => (
                <li key={c.id}>
                  <i className="swatch" style={{ background: c.hex }} />
                  <b>{c.code}</b>
                  <span>{c.name || "未命名"} · 库存 {c.stock} 绞</span>
                  {c.stock <= 0 && <em className="tag warn">缺料</em>}
                  <small>{c.createdAt}</small>
                </li>
              ))}
              {state.colorCards.length === 0 && (
                <li className="empty">尚未登记材料色卡</li>
              )}
            </ul>
          </section>
        </div>

        <section className="sub-panel">
          <h3>补线试色</h3>
          {!testUnlocked ? (
            <div className="locked">
              试色未解锁：
              {[
                state.damages.length === 0 && "需先登记破损区域",
                state.colorCards.length === 0 && "需先登记材料色卡",
              ]
                .filter(Boolean)
                .join("，")}
              。
            </div>
          ) : (
            <form className="mini-form" onSubmit={addTest}>
              <input
                name="formula"
                placeholder="配方，如：靛蓝 2 股 + 茜红 1 股合捻"
                required
              />
              <input
                name="colorCode"
                list="card-codes"
                placeholder="色号（可填未登记色号以比对）"
                required
              />
              <datalist id="card-codes">
                {state.colorCards.map((c) => (
                  <option key={c.id} value={c.code} />
                ))}
              </datalist>
              <input
                name="amount"
                type="number"
                min="1"
                defaultValue="1"
                title="需用线量（绞）"
                placeholder="用量（绞）"
              />
              <select name="result" defaultValue="success">
                <option value="success">试色成功</option>
                <option value="fail">试色失败</option>
              </select>
              <input name="note" placeholder="备注（可选）" />
              <button className="primary" type="submit">记录试色</button>
            </form>
          )}
        </section>

        <section className="sub-panel">
          <h3>试色记录（失败配方留档，不占当前方案）</h3>
          <ul className="test-list">
            {state.tests.map((t) => {
              const card = state.colorCards.find((c) => c.code === t.colorCode);
              const isCurrent = t.id === state.currentPlanId;
              return (
                <li key={t.id} className={isCurrent ? "current" : ""}>
                  <div>
                    <b>{t.formula}</b>
                    <span className="meta">
                      色号 {t.colorCode}
                      {card && (
                        <>
                          {" "}
                          <i className="swatch" style={{ background: card.hex }} />
                        </>
                      )}
                      {" "}· 用量 {t.amount} 绞 · {t.createdAt}
                      {t.note && ` · ${t.note}`}
                    </span>
                  </div>
                  <div className="row-actions">
                    {t.result === "fail" ? (
                      <em className="tag fail">失败留档</em>
                    ) : isCurrent ? (
                      <em className="tag current-tag">当前方案</em>
                    ) : (
                      <button onClick={() => switchPlan(t)}>设为当前方案</button>
                    )}
                  </div>
                </li>
              );
            })}
            {state.tests.length === 0 && (
              <li className="empty">暂无试色记录</li>
            )}
          </ul>
        </section>

        <section className="sub-panel">
          <div className="sub-heading">
            <h3>修复工序（按登记顺序推进）</h3>
            <form className="mini-form inline" onSubmit={addStep}>
              <input name="stepName" placeholder="工序名称，如：补线织补" required />
              <input name="stepDetail" placeholder="说明（可选）" />
              <button type="submit">登记工序</button>
            </form>
          </div>
          <ol className="step-list">
            {state.steps.map((st, i) => (
              <li
                key={st.id}
                className={
                  st.done ? "done" : st.id === nextStepId ? "next" : "waiting"
                }
              >
                <b className="step-no">{String(i + 1).padStart(2, "0")}</b>
                <div>
                  <h4>{st.name}</h4>
                  <p>{st.detail || "—"}</p>
                  <small>
                    {st.done
                      ? `已完成 · ${st.doneAt}`
                      : st.id === nextStepId
                        ? "待推进"
                        : "等待前序工序完成"}
                  </small>
                </div>
                <div className="row-actions">
                  {st.done ? (
                    <button onClick={() => rollbackStep(st.id)}>
                      回退（撤销此步及后续）
                    </button>
                  ) : (
                    <button
                      className="primary"
                      disabled={st.id !== nextStepId}
                      onClick={() => completeStep(st.id)}
                    >
                      完成此步
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </section>
    </main>
  );
}

export default App;
