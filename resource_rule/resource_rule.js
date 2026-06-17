import { initI18n, t } from "../src/i18n.js";
import { blockAtlas, blockAtlasCategories } from "../src/data/blockAtlas.js";
import { createBlockPreviewCanvas } from "../src/world/blockPreview.js";
import "./style.css";
import "../src/site-header.css";
import { finishSiteLoading, setSiteLoadingProgress } from "../src/site-ui.js";

const heroMetrics = document.querySelector("#heroMetrics");
const categoryFilters = document.querySelector("#categoryFilters");
const mobileCategoryFilters = document.querySelector("#mobileCategoryFilters");
const blockSearch = document.querySelector("#blockSearch");
const blockGrid = document.querySelector("#blockGrid");
const blockDetail = document.querySelector("#blockDetail");
const resultCount = document.querySelector("#resultCount");

let searchableText = new Map();

let activeCategory = "all";
let activeBlockKey = blockAtlas[0]?.key ?? "";
let query = "";

setSiteLoadingProgress(34);
await initI18n();
setSiteLoadingProgress(58);
renderAtlas();
finishSiteLoading();

blockSearch.addEventListener("input", () => {
  query = blockSearch.value.trim().toLowerCase();
  renderBlockGrid();
});

window.addEventListener("nicechunk:languagechange", renderAtlas);

function renderAtlas() {
  document.title = t("resourceAtlas.page.title");
  rebuildSearchableText();
  renderHeroMetrics();
  renderCategoryControls(categoryFilters, "vertical");
  renderCategoryControls(mobileCategoryFilters, "rail");
  renderBlockGrid();
}

function renderHeroMetrics() {
  const categoryCount = blockAtlasCategories.filter((category) => category.id !== "all").length;
  const compositionSymbols = new Set(blockAtlas.flatMap((entry) => entry.composition.map(([symbol]) => symbol)));
  const metrics = [
    [String(blockAtlas.length), t("resourceAtlas.page.metric.blocks")],
    [String(categoryCount), t("resourceAtlas.page.metric.families")],
    [String(compositionSymbols.size), t("resourceAtlas.page.metric.elements")],
    ["v1", t("resourceAtlas.page.metric.ruleSet")],
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

  blockDetail.replaceChildren(header, description, tags, compositionSection, physicalSection, signalsSection, colorSection);
}

function renderVoxelCube(entry, size) {
  const cubeWrap = document.createElement("div");
  cubeWrap.className = `voxel-scene ${size} true-render`;
  cubeWrap.append(createBlockPreviewCanvas(entry.key, { size: size === "large" ? 164 : 112 }));
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

function formatVolume(value) {
  return value == null ? t("resourceAtlas.page.notAvailable") : `${formatNumber(value, 6)} m³`;
}

function formatMass(value) {
  return value == null ? t("resourceAtlas.page.notAvailable") : `${formatNumber(value)} kg`;
}

function formatNumber(value, maximumFractionDigits = 3) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
  }).format(value);
}
