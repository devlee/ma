# 收货地址街区收入分析(市场分析用途)

把美国收货地址批量转换为普查区(Census Tract)级别的街区收入数据,并生成聚合市场分析报告。

管道流程:

1. 地址 → 普查区 GEOID:调用免费的 [Census Geocoder 批量 API](https://geocoding.geo.census.gov/)(无需密钥,每批最多 10,000 条)。
2. 普查区 → 家庭收入中位数:调用 [ACS 5 年估计数据 API](https://www.census.gov/programs-surveys/acs)(变量 `B19013_001E`)。
3. 收入分层:按普查区收入与全国中位数的比值打标签(参考 Pew 的中产阶级定义)。
4. 聚合报告:覆盖率、收入分层分布、分州统计等 Markdown 报告。

## 快速开始

```bash
pip install -r requirements.txt

# 申请免费的 Census API key(即时发放):
# https://api.census.gov/data/key_signup.html
export CENSUS_API_KEY=your_key_here

python -m income_insights.cli \
  --input sample_data/addresses.csv \
  --output out/enriched.csv \
  --report out/report.md
```

没有 API key 时可以先跑地理编码(只输出普查区 GEOID,不含收入):

```bash
python -m income_insights.cli --input ... --output ... --geocode-only
```

## 输入格式

CSV 文件,需包含街道、城市、州、邮编四列(列名大小写不敏感,支持常见别名如
`address`/`street`、`zip`/`zipcode`/`postal_code`),可选 `id` 和 `category`
(购买品类,别名 `product_category` 等)列。见 `sample_data/addresses.csv`。

不需要、也不建议包含姓名、电话、邮箱等个人身份信息——地址加品类即可完成分析
(数据最小化原则)。

## 输出

- 明细 CSV:每条地址附加 `tract_geoid`、`tract_median_household_income`、`income_tier`。
- 聚合报告(`--report`):地理编码匹配率、收入分层分布表、分州统计、品类 × 收入
  分层交叉表(输入含品类列时)、方法论说明。

## 收入分层定义

以全国家庭收入中位数为基准(比值区间左闭右开):

| 标签 | 区间 |
| --- | --- |
| `low` | < 0.5x |
| `lower_middle` | 0.5x – 0.8x |
| `middle` | 0.8x – 1.2x |
| `upper_middle` | 1.2x – 2.0x |
| `high` | >= 2.0x |
| `unknown` | 地址未匹配或该普查区数据被抑制 |

分层边界在 `income_insights/tiers.py` 中可配置。

## 重要限制与合规说明

- 输出的是**街区(普查区)层面的统计值**,不是任何一位用户的真实收入;同一街区内部家庭差异可能很大(生态谬误)。
- 收货地址可能是公司、转运仓或代收人,存在噪声。
- 本工具仅用于**聚合层面的市场分析**。不要把推断结果用于针对单个用户的自动化决策(差异化定价、信贷审批、资格判定等),此类用途可能触及 ECOA/FCRA 及各州反歧视法规。
- 如受 CCPA/CPRA 等隐私法约束,从地址推断出的收入属于需要披露的个人信息推断(inferences),请纳入隐私政策。

## 测试

```bash
python -m pytest tests/ -v
```

测试使用 mock 的 API 响应,无需网络和 API key。
