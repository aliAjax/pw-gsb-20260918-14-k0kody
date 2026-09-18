export interface DamageArea {
  id: string;
  zone: string;
  kind: string;
  size: string;
  createdAt: string;
}

export interface ColorCard {
  id: string;
  code: string;
  name: string;
  hex: string;
  stock: number;
  createdAt: string;
}

export type TestResult = "success" | "fail";

export interface ColorTest {
  id: string;
  formula: string;
  colorCode: string;
  amount: number;
  result: TestResult;
  note: string;
  createdAt: string;
}

export interface ProcessStep {
  id: string;
  name: string;
  detail: string;
  done: boolean;
  doneAt: string | null;
  createdAt: string;
}

export interface RepairState {
  damages: DamageArea[];
  colorCards: ColorCard[];
  tests: ColorTest[];
  currentPlanId: string | null;
  steps: ProcessStep[];
}

export const STORAGE_KEY = "hxyfront-62009:repair-loop:v1";

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const nowText = () =>
  new Date().toLocaleString("zh-CN", { hour12: false });

export const seedState: RepairState = {
  damages: [],
  colorCards: [],
  tests: [],
  currentPlanId: null,
  steps: [
    {
      id: "step-clean",
      name: "清洗除尘",
      detail: "软毛刷与中性洗剂处理破损周边",
      done: false,
      doneAt: null,
      createdAt: "初始登记",
    },
    {
      id: "step-darn",
      name: "补线织补",
      detail: "按当前方案配色补线，逐结织补",
      done: false,
      doneAt: null,
      createdAt: "初始登记",
    },
    {
      id: "step-finish",
      name: "整平定型",
      detail: "剪平绒面、蒸汽定型并复核色差",
      done: false,
      doneAt: null,
      createdAt: "初始登记",
    },
  ],
};

export function loadState(): RepairState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState;
    const parsed = JSON.parse(raw) as Partial<RepairState>;
    if (
      !Array.isArray(parsed.damages) ||
      !Array.isArray(parsed.colorCards) ||
      !Array.isArray(parsed.tests) ||
      !Array.isArray(parsed.steps)
    ) {
      return seedState;
    }
    return {
      damages: parsed.damages,
      colorCards: parsed.colorCards,
      tests: parsed.tests,
      steps: parsed.steps,
      currentPlanId:
        typeof parsed.currentPlanId === "string" ? parsed.currentPlanId : null,
    };
  } catch {
    return seedState;
  }
}

/** 破损区域与色卡都登记后，才允许进入试色。 */
export const canStartTesting = (s: RepairState) =>
  s.damages.length > 0 && s.colorCards.length > 0;

/**
 * 切换当前方案前核对色卡一致性。
 * 返回缺失项列表；非空时表示缺料或色号不匹配，原方案与工序保持不变。
 */
export function validatePlanSwitch(
  state: RepairState,
  test: ColorTest,
): string[] {
  const missing: string[] = [];
  const card = state.colorCards.find(
    (c) => c.code.trim() === test.colorCode.trim(),
  );
  if (!card) {
    missing.push(`色号 ${test.colorCode} 未在材料色卡中登记（色号不匹配）`);
  } else if (card.stock < test.amount) {
    missing.push(
      `色卡 ${card.code}（${card.name || "未命名"}）线材缺料：需 ${test.amount} 绞，库存仅 ${card.stock} 绞`,
    );
  }
  return missing;
}
