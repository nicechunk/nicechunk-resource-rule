import { initI18n, t } from "../src/i18n.js";
import { blockAtlas, blockAtlasCategories } from "../src/data/blockAtlas.js";
import { smeltingRules as sharedSmeltingRules } from "../src/data/smeltingRules.js";
import { resourceDropRules, resourceDropRuleSet } from "../src/data/resourceDropRules.js";
import { getWorldAlgorithmSpec } from "../src/data/worldAlgorithmRules.js";
import {
  createResourceBlockPreviewCanvas,
  createResourceMaterialPreviewCanvas,
  elementColor,
  resourceMaterialColors,
  resourceMaterialComposition,
} from "../src/render/resourcePreview.js";
import "./style.css";
import "../src/site-header.css";
import { finishSiteLoading, setSiteLoadingProgress } from "../src/site-ui.js";

const heroMetrics = document.querySelector("#heroMetrics");
const rawResourceWorkspace = document.querySelector("#rawResourceWorkspace");
const materialResourceWorkspace = document.querySelector("#materialResourceWorkspace");
const resourceModeDescription = document.querySelector("#resourceModeDescription");
const resourceModeButtons = Array.from(document.querySelectorAll("[data-resource-mode]"));
const categoryFilters = document.querySelector("#categoryFilters");
const mobileCategoryFilters = document.querySelector("#mobileCategoryFilters");
const blockSearch = document.querySelector("#blockSearch");
const blockGrid = document.querySelector("#blockGrid");
const blockDetail = document.querySelector("#blockDetail");
const resultCount = document.querySelector("#resultCount");
const smeltingRuleSet = document.querySelector("#smeltingRuleSet");
const fuelGrid = document.querySelector("#fuelGrid");
const materialCategoryFilters = document.querySelector("#materialCategoryFilters");
const mobileMaterialCategoryFilters = document.querySelector("#mobileMaterialCategoryFilters");
const materialSearch = document.querySelector("#materialSearch");
const materialResultCount = document.querySelector("#materialResultCount");
const materialList = document.querySelector("#materialList");
const materialDetail = document.querySelector("#materialDetail");

let searchableText = new Map();
let searchableMaterialText = new Map();

let activeCategory = "all";
let activeBlockKey = blockAtlas[0]?.key ?? "";
let activeMaterialClass = "all";
let activeMaterialId = "";
let activeResourceMode = "raw";
let query = "";
let materialQuery = "";
let smeltingRules = sharedSmeltingRules;

setSiteLoadingProgress(34);
await initI18n();
setSiteLoadingProgress(58);
renderAtlas();
finishSiteLoading();

blockSearch.addEventListener("input", () => {
  query = blockSearch.value.trim().toLowerCase();
  renderBlockGrid();
});

materialSearch?.addEventListener("input", () => {
  materialQuery = materialSearch.value.trim().toLowerCase();
  renderMaterialList();
});

resourceModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeResourceMode = button.dataset.resourceMode === "materials" ? "materials" : "raw";
    renderResourceMode();
  });
});

window.addEventListener("nicechunk:languagechange", renderAtlas);

function renderAtlas() {
  document.title = t("resourceAtlas.page.title");
  rebuildSearchableText();
  rebuildMaterialSearchableText();
  renderHeroMetrics();
  renderResourceMode();
  renderCategoryControls(categoryFilters, "vertical");
  renderCategoryControls(mobileCategoryFilters, "rail");
  renderBlockGrid();
  renderMaterialRules();
}

function renderHeroMetrics() {
  const worldAlgorithmSpec = getWorldAlgorithmSpec();
  const categoryCount = blockAtlasCategories.filter((category) => category.id !== "all").length;
  const compositionSymbols = new Set(blockAtlas.flatMap((entry) => entry.composition.map(([symbol]) => symbol)));
  const metrics = [
    [String(blockAtlas.length), t("resourceAtlas.page.metric.blocks")],
    [String(categoryCount), t("resourceAtlas.page.metric.families")],
    [String(compositionSymbols.size), t("resourceAtlas.page.metric.elements")],
    [String(smeltingRules.materials?.length ?? 0), t("resourceAtlas.page.metric.materials")],
    [String(worldAlgorithmSpec.rules.blocks.length), t("resourceAtlas.page.metric.worldRules")],
  ];

  heroMetrics.replaceChildren(
    ...metrics.map(([value, label]) => {
      const card = document.createElement("article");
      const valueNode = document.createElement("strong");
      valueNode.textContent = value;
      const labelNode = document.createElement("span");
      labelNode.textContent = label;
      card.append(valueNode, labelNode);
      return card;
    }),
  );
}

function renderResourceMode() {
  const materialMode = activeResourceMode === "materials";
  rawResourceWorkspace?.classList.toggle("hidden", materialMode);
  materialResourceWorkspace?.classList.toggle("hidden", !materialMode);
  resourceModeDescription.textContent = t(materialMode ? "resourceAtlas.page.materialModeBody" : "resourceAtlas.page.rawModeBody");
  resourceModeButtons.forEach((button) => {
    const active = button.dataset.resourceMode === activeResourceMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderMaterialRules() {
  if (!fuelGrid || !materialList || !materialDetail) return;
  if (smeltingRuleSet) smeltingRuleSet.textContent = smeltingRules.ruleSet ?? "nicechunk-smelting-v1";
  fuelGrid.replaceChildren(...(smeltingRules.fuels ?? []).map(renderFuelCard));
  renderMaterialCategoryControls(materialCategoryFilters, "vertical");
  renderMaterialCategoryControls(mobileMaterialCategoryFilters, "rail");
  renderMaterialList();
}

function renderFuelCard(fuel) {
  const card = document.createElement("article");
  card.className = "fuel-card";
  const title = document.createElement("h4");
  title.textContent = t(`resourceAtlas.material.fuel.${fuel.id}.name`);
  const detail = document.createElement("p");
  detail.textContent = t(`resourceAtlas.material.fuel.${fuel.id}.description`);
  const meta = document.createElement("div");
  meta.className = "material-meta-grid";
  meta.append(
    valuePill(t("resourceAtlas.material.heatLabel"), heatTierText(fuel.heatTier)),
    valuePill(t("resourceAtlas.material.burnTimeLabel"), t("resourceAtlas.material.burnSeconds", { seconds: fuel.burnSeconds ?? 0 })),
    valuePill(t("resourceAtlas.material.sourceLabel"), sourceText(fuel)),
    valuePill(t("resourceAtlas.material.consumableLabel"), t(fuel.consumable === false ? "resourceAtlas.material.reusable" : "resourceAtlas.material.consumable")),
  );
  card.append(title, detail, meta);
  return card;
}

function valuePill(labelText, valueText) {
  const pill = document.createElement("div");
  pill.className = "material-value";
  const label = document.createElement("span");
  label.textContent = labelText;
  const value = document.createElement("strong");
  value.textContent = valueText;
  pill.append(label, value);
  return pill;
}

function heatTierText(tier) {
  const heatTier = (smeltingRules.heatTiers ?? []).find((item) => item.tier === tier);
  const name = t(`resourceAtlas.material.heatTier.${heatTier?.key ?? "unknown"}`);
  return t("resourceAtlas.material.heatTierValue", { tier: tier ?? 0, name, temp: heatTier?.temperatureC ?? 0 });
}

function sourceText(fuel) {
  if (fuel.sourceType === "material") return t(`resourceAtlas.material.item.${fuel.materialId}.name`);
  return (fuel.sourceKeys ?? []).map((key) => blockNameByKey(key)).join(", ");
}

function inputListText(inputs = []) {
  return inputs.map((input) => t("resourceAtlas.material.inputAmount", { amount: input.amount ?? 1, resource: blockNameByKey(input.key) })).join(", ");
}

function renderMaterialCategoryControls(target, layout) {
  if (!target) return;
  const categories = materialCategories();
  target.replaceChildren(
    ...categories.map((category) => {
      const count = category.id === "all" ? smeltingRules.materials.length : smeltingRules.materials.filter((recipe) => recipe.class === category.id).length;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `category-button ${layout}`;
      button.classList.toggle("active", category.id === activeMaterialClass);
      button.setAttribute("aria-pressed", String(category.id === activeMaterialClass));
      button.addEventListener("click", () => {
        activeMaterialClass = category.id;
        renderMaterialCategoryControls(materialCategoryFilters, "vertical");
        renderMaterialCategoryControls(mobileMaterialCategoryFilters, "rail");
        renderMaterialList();
      });

      const label = document.createElement("span");
      label.textContent = materialClassLabel(category.id);
      const badge = document.createElement("strong");
      badge.textContent = String(count).padStart(2, "0");
      button.append(label, badge);
      return button;
    }),
  );
}

function materialCategories() {
  const classes = [...new Set((smeltingRules.materials ?? []).map((recipe) => recipe.class).filter(Boolean))].sort((a, b) =>
    materialClassLabel(a).localeCompare(materialClassLabel(b)),
  );
  return [{ id: "all" }, ...classes.map((id) => ({ id }))];
}

function renderMaterialList() {
  if (!materialList || !materialDetail) return;
  const recipes = filteredMaterials();
  if (materialResultCount) materialResultCount.textContent = t("resourceAtlas.material.resultCount", { count: recipes.length });

  if (!recipes.some((recipe) => recipe.id === activeMaterialId)) {
    activeMaterialId = recipes[0]?.id ?? smeltingRules.materials?.[0]?.id ?? "";
  }

  materialList.replaceChildren(
    ...recipes.map((recipe) => {
      const card = document.createElement("article");
      const colors = materialColors(recipe);
      card.className = "material-card";
      card.classList.toggle("active", recipe.id === activeMaterialId);
      card.dataset.materialId = recipe.id;
      card.style.setProperty("--material-c0", colors[0]);
      card.style.setProperty("--material-c1", colors[1]);
      card.style.setProperty("--material-c2", colors[2]);
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", t("resourceAtlas.material.materialAria", { name: materialName(recipe) }));
      card.addEventListener("click", () => selectMaterial(recipe.id));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectMaterial(recipe.id);
        }
      });

      const visual = renderMaterialVisual(recipe, "small");
      const copy = document.createElement("div");
      copy.className = "material-card-copy";

      const top = document.createElement("div");
      top.className = "card-topline";
      const classNode = document.createElement("span");
      classNode.textContent = materialClassLabel(recipe.class);
      const heatNode = document.createElement("span");
      heatNode.textContent = heatTierShortText(recipe.requiredHeatTier);
      top.append(classNode, heatNode);

      const title = document.createElement("h4");
      title.textContent = materialName(recipe);
      const description = document.createElement("p");
      description.textContent = materialDescription(recipe);
      const composition = document.createElement("div");
      composition.className = "composition-strip";
      materialComposition(recipe).slice(0, 4).forEach(([symbol, range]) => {
        composition.append(renderCompositionChip(symbol, range));
      });
      copy.append(top, title, description, composition);
      card.append(visual, copy);
      return card;
    }),
  );

  if (!recipes.length) {
    const empty = document.createElement("article");
    empty.className = "empty-state";
    empty.textContent = t("resourceAtlas.material.empty");
    materialList.append(empty);
  }

  renderMaterialDetail(activeMaterialId);
}

function selectMaterial(id) {
  activeMaterialId = id;
  materialList?.querySelectorAll(".material-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.materialId === activeMaterialId);
  });
  renderMaterialDetail(id);
}

function renderMaterialDetail(id) {
  const recipe = smeltingRules.materials?.find((item) => item.id === id) ?? smeltingRules.materials?.[0];
  if (!recipe || !materialDetail) {
    materialDetail?.replaceChildren();
    return;
  }

  const colors = materialColors(recipe);
  materialDetail.style.setProperty("--material-c0", colors[0]);
  materialDetail.style.setProperty("--material-c1", colors[1]);
  materialDetail.style.setProperty("--material-c2", colors[2]);

  const header = document.createElement("div");
  header.className = "material-detail-header";
  header.append(renderMaterialVisual(recipe, "large"));
  const titleWrap = document.createElement("div");
  const eyebrow = document.createElement("span");
  eyebrow.className = "detail-eyebrow";
  eyebrow.textContent = `${recipe.id} / ${recipe.class}`;
  const title = document.createElement("h2");
  title.textContent = materialName(recipe);
  const meta = document.createElement("p");
  meta.textContent = `${materialClassLabel(recipe.class)} · ${heatTierText(recipe.requiredHeatTier)} · ${t("resourceAtlas.material.artisanLevel", { level: recipe.artisanLevel ?? 1 })}`;
  titleWrap.append(eyebrow, title, meta);
  header.append(titleWrap);

  const description = document.createElement("p");
  description.className = "detail-description";
  description.textContent = materialDescription(recipe);

  const processSection = renderDetailSection(t("resourceAtlas.material.processTitle"), [
    renderPhysicalRow(t("resourceAtlas.material.rawInputsLabel"), inputListText(recipe.rawInputs)),
    ...(recipe.catalysts?.length ? [renderPhysicalRow(t("resourceAtlas.material.catalystLabel"), inputListText(recipe.catalysts))] : []),
    renderPhysicalRow(t("resourceAtlas.material.requiredHeatLabel"), heatTierText(recipe.requiredHeatTier)),
    renderPhysicalRow(t("resourceAtlas.material.artisanLevelLabel"), t("resourceAtlas.material.artisanLevel", { level: recipe.artisanLevel ?? 1 })),
    renderPhysicalRow(t("resourceAtlas.material.yieldLabel"), t("resourceAtlas.material.yieldCount", { count: recipe.yieldCount ?? 1 })),
  ]);

  const compositionSection = renderDetailSection(
    t("resourceAtlas.material.compositionTitle"),
    materialComposition(recipe).map(([symbol, range]) => renderCompositionRow(symbol, range)),
  );

  const forgeSection = renderDetailSection(t("resourceAtlas.material.forgeUseTitle"), [
    renderPhysicalRow(t("resourceAtlas.material.forgeUseLabel"), t(`resourceAtlas.material.forgeUse.${recipe.forgeUse}`)),
  ]);

  const sourceSection = renderDetailSection(
    t("resourceAtlas.material.sourceBlocksTitle"),
    recipe.rawInputs.map((input) => renderMaterialSourceRow(input)),
  );

  materialDetail.replaceChildren(header, description, processSection, compositionSection, forgeSection, sourceSection);
}

function renderMaterialSourceRow(input) {
  const row = document.createElement("div");
  row.className = "material-source-row";
  const entry = blockAtlas.find((item) => item.key === input.key);
  if (entry) row.append(renderVoxelCube(entry, "tiny"));
  const copy = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = blockNameByKey(input.key);
  const amount = document.createElement("span");
  amount.textContent = t("resourceAtlas.material.inputAmount", { amount: input.amount ?? 1, resource: blockNameByKey(input.key) });
  copy.append(name, amount);
  row.append(copy);
  return row;
}

function renderMaterialVisual(recipe, size) {
  const visual = document.createElement("div");
  visual.className = `material-visual ${size} material-visual-${recipe.class ?? "generic"}`;
  visual.setAttribute("aria-hidden", "true");
  const composition = materialComposition(recipe);
  const symbols = composition.slice(0, 3).map(([symbol]) => symbol);
  const previewSize = size === "large" ? 164 : 112;
  visual.append(createResourceMaterialPreviewCanvas(recipe, { size: previewSize }));

  const palette = document.createElement("div");
  palette.className = "material-color-strip";
  for (let index = 0; index < 3; index++) {
    const chip = document.createElement("span");
    chip.textContent = symbols[index] ?? "";
    chip.style.setProperty("--chip-color", elementColor(symbols[index] ?? "O"));
    palette.append(chip);
  }
  visual.append(palette);
  return visual;
}

function filteredMaterials() {
  return (smeltingRules.materials ?? []).filter((recipe) => {
    const classMatch = activeMaterialClass === "all" || recipe.class === activeMaterialClass;
    const queryMatch = !materialQuery || searchableMaterialText.get(recipe.id)?.includes(materialQuery);
    return classMatch && queryMatch;
  });
}

function rebuildMaterialSearchableText() {
  searchableMaterialText = new Map(
    (smeltingRules.materials ?? []).map((recipe) => [
      recipe.id,
      [
        recipe.id,
        recipe.class,
        materialClassLabel(recipe.class),
        materialName(recipe),
        materialDescription(recipe),
        t(`resourceAtlas.material.forgeUse.${recipe.forgeUse}`),
        inputListText(recipe.rawInputs),
        inputListText(recipe.catalysts),
        materialComposition(recipe).map(([symbol, range]) => `${symbol} ${elementDisplayName(symbol)} ${range}`).join(" "),
      ]
        .join(" ")
        .toLowerCase(),
    ]),
  );
}

function materialName(recipe) {
  return t(`resourceAtlas.material.item.${recipe.id}.name`);
}

function materialDescription(recipe) {
  return t(`resourceAtlas.material.item.${recipe.id}.description`);
}

function materialClassLabel(className) {
  if (className === "all") return t("resourceAtlas.material.allMaterials");
  return t(`resourceAtlas.material.class.${className}`);
}

function materialComposition(recipe) {
  return resourceMaterialComposition(recipe);
}

function materialColors(recipe) {
  return resourceMaterialColors(recipe);
}

function heatTierShortText(tier) {
  return t("resourceAtlas.material.heatTierShort", { tier: tier ?? 0 });
}

function blockNameByKey(key) {
  const entry = blockAtlas.find((item) => item.key === key);
  return entry ? blockName(entry) : key;
}

function renderCategoryControls(target, layout) {
  target.replaceChildren(
    ...blockAtlasCategories.map((category) => {
      const count = category.id === "all" ? blockAtlas.length : blockAtlas.filter((entry) => entry.category === category.id).length;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `category-button ${layout}`;
      button.classList.toggle("active", category.id === activeCategory);
      button.setAttribute("aria-pressed", String(category.id === activeCategory));
      button.addEventListener("click", () => {
        activeCategory = category.id;
        renderCategoryControls(categoryFilters, "vertical");
        renderCategoryControls(mobileCategoryFilters, "rail");
        renderBlockGrid();
      });

      const label = document.createElement("span");
      label.textContent = categoryLabel(category.id);
      const badge = document.createElement("strong");
      badge.textContent = String(count).padStart(2, "0");
      button.append(label, badge);
      return button;
    }),
  );
}

function renderBlockGrid() {
  const entries = filteredBlocks();
  resultCount.textContent = t("resourceAtlas.page.resultCount", { count: entries.length });

  if (!entries.some((entry) => entry.key === activeBlockKey)) {
    activeBlockKey = entries[0]?.key ?? blockAtlas[0]?.key ?? "";
  }

  blockGrid.replaceChildren(
    ...entries.map((entry) => {
      const card = document.createElement("article");
      card.className = "block-card";
      card.classList.toggle("active", entry.key === activeBlockKey);
      card.style.setProperty("--accent", entry.colors[0]);
      card.dataset.key = entry.key;
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", t("resourceAtlas.page.blockAria", { name: blockName(entry) }));
      card.addEventListener("click", () => selectBlock(entry.key));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectBlock(entry.key);
        }
      });

      const media = document.createElement("div");
      media.className = "card-media";
      media.append(renderVoxelCube(entry, "small"));

      const copy = document.createElement("div");
      copy.className = "card-copy";
      const top = document.createElement("div");
      top.className = "card-topline";
      const code = document.createElement("span");
      code.textContent = entry.id;
      const category = document.createElement("span");
      category.textContent = categoryLabel(entry.category);
      top.append(code, category);

      const title = document.createElement("h2");
      title.textContent = blockName(entry);

      const description = document.createElement("p");
      description.textContent = blockDescription(entry);

      const composition = document.createElement("div");
      composition.className = "composition-strip";
      entry.composition.slice(0, 5).forEach(([symbol, range]) => {
        composition.append(renderCompositionChip(symbol, range));
      });

      copy.append(top, title, description, composition);
      card.append(media, copy);
      return card;
    }),
  );

  if (!entries.length) {
    const empty = document.createElement("article");
    empty.className = "empty-state";
    empty.textContent = t("resourceAtlas.page.empty");
    blockGrid.append(empty);
  }

  renderDetail(activeBlockKey);
}

function selectBlock(key) {
  activeBlockKey = key;
  blockGrid.querySelectorAll(".block-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.key === activeBlockKey);
  });
  renderDetail(key);
}

function renderDetail(key) {
  const entry = blockAtlas.find((item) => item.key === key) ?? blockAtlas[0];
  if (!entry) {
    blockDetail.replaceChildren();
    return;
  }

  blockDetail.style.setProperty("--accent", entry.colors[0]);

  const header = document.createElement("div");
  header.className = "detail-header";
  header.append(renderVoxelCube(entry, "large"));

  const titleWrap = document.createElement("div");
  const eyebrow = document.createElement("span");
  eyebrow.className = "detail-eyebrow";
  eyebrow.textContent = `${entry.id} / ${entry.key}`;
  const title = document.createElement("h2");
  title.textContent = blockName(entry);
  const meta = document.createElement("p");
  meta.textContent = `${categoryLabel(entry.category)} · ${blockSource(entry)} · ${rarityLabel(entry.rarityLabel)}`;
  titleWrap.append(eyebrow, title, meta);
  header.append(titleWrap);

  const description = document.createElement("p");
  description.className = "detail-description";
  description.textContent = blockDescription(entry);

  const tags = document.createElement("div");
  tags.className = "tag-list";
  entry.tags.forEach((tag) => {
    const chip = document.createElement("span");
    chip.textContent = blockTag(tag);
    tags.append(chip);
  });

  const compositionSection = renderDetailSection(
    t("resourceAtlas.page.compositionTitle"),
    entry.composition.map(([symbol, range]) => renderCompositionRow(symbol, range)),
  );
  const physicalSection = renderDetailSection(
    t("resourceAtlas.page.physicalTitle"),
    [
      renderPhysicalRow(t("resourceAtlas.page.densityLabel"), formatDensity(entry.physical?.densityKgM3)),
      renderPhysicalRow(t("resourceAtlas.page.dimensionsLabel"), formatDimensions(entry.physical?.dimensionsM)),
      renderPhysicalRow(t("resourceAtlas.page.volumeLabel"), formatVolume(entry.physical?.volumeM3)),
      renderPhysicalRow(t("resourceAtlas.page.massLabel"), formatMass(entry.physical?.massKg)),
    ],
  );
  const signalsSection = renderDetailSection(
    t("resourceAtlas.page.signalsTitle"),
    Object.entries(entry.signals).map(([keyName, value]) => renderSignalRow(keyName, value)),
  );
  const colorSection = renderDetailSection(
    t("resourceAtlas.page.visualTitle"),
    entry.colors.map((color, index) => renderColorRow(color, index)),
  );
  const dropSection = renderResourceDropSection(entry);

  blockDetail.replaceChildren(header, description, tags, compositionSection, physicalSection, signalsSection, colorSection, ...dropSection);
}

function renderVoxelCube(entry, size) {
  const cubeWrap = document.createElement("div");
  cubeWrap.className = `voxel-scene ${size} true-render`;
  cubeWrap.append(createResourceBlockPreviewCanvas(entry.key, { size: size === "large" ? 164 : 112 }));
  return cubeWrap;
}

function renderCompositionChip(symbol, range) {
  const chip = document.createElement("span");
  chip.className = "composition-chip";
  const element = document.createElement("strong");
  element.textContent = symbol;
  const name = document.createElement("em");
  name.textContent = elementDisplayName(symbol);
  const amount = document.createElement("span");
  amount.textContent = range;
  chip.append(element, name, amount);
  return chip;
}

function renderCompositionRow(symbol, range) {
  const row = document.createElement("div");
  row.className = "composition-row";
  row.append(renderCompositionChip(symbol, range));
  const bar = document.createElement("span");
  bar.className = "range-bar";
  bar.style.setProperty("--range", `${Math.max(8, rangeMidpoint(range))}%`);
  row.append(bar);
  return row;
}

function renderSignalRow(keyName, value) {
  const row = document.createElement("div");
  row.className = "signal-row";
  const label = document.createElement("span");
  label.textContent = t(`resourceAtlas.signal.${keyName}`);
  const valueNode = document.createElement("strong");
  valueNode.textContent = keyName === "rarity" ? `${value} / 100 · ${rarityLabel(rarityFromValue(value))}` : `${value} / 100`;
  const bar = document.createElement("i");
  bar.style.setProperty("--value", `${value}%`);
  row.append(label, valueNode, bar);
  return row;
}

function renderPhysicalRow(labelText, valueText) {
  const row = document.createElement("div");
  row.className = "physical-row";
  const label = document.createElement("span");
  label.textContent = labelText;
  const value = document.createElement("strong");
  value.textContent = valueText;
  row.append(label, value);
  return row;
}

function renderColorRow(color, index) {
  const row = document.createElement("div");
  row.className = "color-row";
  const swatch = document.createElement("i");
  swatch.style.background = color;
  const label = document.createElement("span");
  label.textContent = t(`resourceAtlas.page.color.${index}`);
  const value = document.createElement("strong");
  value.textContent = color;
  row.append(swatch, label, value);
  return row;
}

function renderDetailSection(titleText, nodes) {
  const section = document.createElement("section");
  section.className = "detail-section";
  const title = document.createElement("h3");
  title.textContent = titleText;
  const body = document.createElement("div");
  body.className = "detail-section-body";
  body.append(...nodes);
  section.append(title, body);
  return section;
}

function renderResourceDropSection(entry) {
  const rules = resourceDropRules.filter((rule) => rule.dropKey === entry.key);
  if (!rules.length) return [];
  const table = document.createElement("table");
  table.className = "detail-drop-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  [
    t("resourceAtlas.drop.source"),
    t("resourceAtlas.drop.chance"),
    t("resourceAtlas.drop.size"),
    t("resourceAtlas.drop.altitude"),
    t("resourceAtlas.drop.depth"),
  ].forEach((labelText) => {
    const th = document.createElement("th");
    th.textContent = labelText;
    headRow.append(th);
  });
  thead.append(headRow);
  const tbody = document.createElement("tbody");
  rules.forEach((rule) => {
    const row = document.createElement("tr");
    row.append(
      renderDropRuleValue(blockNameByKey(rule.sourceKey), rule.sourceKey),
      renderDropRuleValue(t("resourceAtlas.drop.chanceValue", { value: formatChance(rule.chanceBps) })),
      renderDropRuleValue(formatDropDimensions(rule)),
      renderDropRuleValue(t("resourceAtlas.drop.rangeValue", { min: rule.minAltitude, max: rule.maxAltitude })),
      renderDropRuleValue(t("resourceAtlas.drop.rangeValue", { min: rule.minDepth, max: rule.maxDepth })),
    );
    tbody.append(row);
  });
  table.append(thead, tbody);
  const note = document.createElement("p");
  note.className = "detail-drop-note";
  note.textContent = t("resourceAtlas.drop.detailBody", { ruleSet: resourceDropRuleSet });
  return [renderDetailSection(t("resourceAtlas.drop.detailTitle"), [table, note])];
}

function renderDropRuleValue(primary, secondary = "") {
  const cell = document.createElement("td");
  const strong = document.createElement("strong");
  strong.textContent = primary;
  cell.append(strong);
  if (secondary) {
    const span = document.createElement("span");
    span.textContent = secondary;
    cell.append(span);
  }
  return cell;
}

function filteredBlocks() {
  return blockAtlas.filter((entry) => {
    const categoryMatch = activeCategory === "all" || entry.category === activeCategory;
    const queryMatch = !query || searchableText.get(entry.key)?.includes(query);
    return categoryMatch && queryMatch;
  });
}

function rebuildSearchableText() {
  searchableText = new Map(
    blockAtlas.map((entry) => [
      entry.key,
      [
        entry.id,
        entry.key,
        entry.name,
        blockName(entry),
        entry.category,
        entry.source,
        blockSource(entry),
        entry.tags.join(" "),
        entry.tags.map(blockTag).join(" "),
        entry.description,
        blockDescription(entry),
        entry.composition.map(([symbol, range]) => `${symbol} ${range}`).join(" "),
        entry.physical?.densityKgM3,
        entry.physical?.massKg,
        entry.physical?.volumeM3,
        Object.keys(entry.signals).join(" "),
        entry.rarityLabel,
        rarityLabel(entry.rarityLabel),
      ]
        .join(" ")
        .toLowerCase(),
    ]),
  );
}

function categoryLabel(category) {
  return t(`resourceAtlas.category.${category}`);
}

function blockName(entry) {
  return localizedBlockValue(entry, "name");
}

function blockDescription(entry) {
  return localizedBlockValue(entry, "description");
}

function blockSource(entry) {
  return localizedBlockValue(entry, "source");
}

function localizedBlockValue(entry, field) {
  const key = `resourceAtlas.block.${entry.key}.${field}`;
  const translated = t(key);
  return translated === key ? entry[field] : translated;
}

function blockTag(tag) {
  const key = `resourceAtlas.tag.${tagKey(tag)}`;
  const translated = t(key);
  return translated === key ? tag : translated;
}

function tagKey(tag) {
  return String(tag)
    .replaceAll("/", " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part, index) => {
      const normalized = part.toLowerCase().replace(/[^a-z0-9]/g, "");
      return index === 0 ? normalized : normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join("");
}

function elementDisplayName(symbol) {
  const key = `elements.names.${symbol}`;
  const translated = t(key);
  return translated === key ? symbol : translated;
}

function rarityLabel(label) {
  return t(`resourceAtlas.rarity.${label}`);
}

function rarityFromValue(value) {
  if (value >= 78) return "Anomaly";
  if (value >= 68) return "Rare";
  if (value >= 50) return "Uncommon";
  return "Common";
}

function rangeMidpoint(range) {
  const numbers = String(range)
    .match(/[\d.]+/g)
    ?.map(Number)
    .filter(Number.isFinite);
  if (!numbers?.length) return 8;
  if (numbers.length === 1) return numbers[0];
  return (numbers[0] + numbers[1]) / 2;
}

function formatDensity(value) {
  return value == null ? t("resourceAtlas.page.notAvailable") : `${formatNumber(value)} kg/m³`;
}

function formatDimensions(dimensionsM) {
  if (!dimensionsM) return t("resourceAtlas.page.notAvailable");
  const values = [dimensionsM.width, dimensionsM.height, dimensionsM.depth];
  if (values.some((value) => !Number.isFinite(value))) return t("resourceAtlas.page.notAvailable");
  return values.map((value) => `${formatNumber(value)} m`).join(" x ");
}

function formatDropDimensions(rule) {
  if (!rule?.minDimensionsM || !rule?.maxDimensionsM) return t("resourceAtlas.page.notAvailable");
  return t("resourceAtlas.drop.sizeValue", {
    min: formatDimensions(rule.minDimensionsM),
    max: formatDimensions(rule.maxDimensionsM),
  });
}

function formatVolume(value) {
  return value == null ? t("resourceAtlas.page.notAvailable") : `${formatNumber(value, 6)} m³`;
}

function formatMass(value) {
  return value == null ? t("resourceAtlas.page.notAvailable") : `${formatNumber(value)} kg`;
}

function formatChance(chanceBps) {
  const value = Number(chanceBps) / 100;
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value < 1 ? 2 : 1,
  }).format(value);
}

function formatNumber(value, maximumFractionDigits = 3) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
  }).format(value);
}
