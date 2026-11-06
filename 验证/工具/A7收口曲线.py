"""Exact read-only population/food series; separate accounts, no synthetic aggregate."""
from pathlib import Path
import csv,json,datetime
root=Path('验证/A7收口')
for route in ('public','industry'):
    base=root/route
    rows=[json.loads(x) for x in (base/'timeline.ndjson').read_text().splitlines() if x]
    start=datetime.datetime.fromisoformat(json.loads((base/'start.json').read_text())['wall'].replace('Z','+00:00'))
    fields=['wall','wall_minutes','simulated_seconds','calendar_year','rate','effective_rate','paused','stage','origin_population','visible_census_population','world_population','origin_food','terraces_food','yards_food','canal_food','second_city_food','third_city_food','north_local_food','east_local_food','national_food','advanced_food','origin_health','event']
    with (base/'人口与粮食曲线.csv').open('w',newline='') as out:
        writer=csv.DictWriter(out,fieldnames=fields);writer.writeheader()
        for x in rows:
            f=x.get('foodLedgers',{});wards=f.get('wards',{})
            writer.writerow(dict(zip(fields,[x['wall'],round((datetime.datetime.fromisoformat(x['wall'].replace('Z','+00:00'))-start).total_seconds()/60,3),x['at'],round(x['at']/600,3),x['rate'],x.get('effectiveRate',x['rate']),x['paused'],x['stage'],x['people'],x.get('known'),x['total'],f.get('origin'),wards.get('terraces'),wards.get('yards'),wards.get('canal'),f.get('secondCity'),f.get('thirdCity'),f.get('northLocal'),f.get('eastLocal'),f.get('national'),f.get('advanced'),x.get('health'),x.get('event')])))
    print(route,len(rows),'observations; all food accounts remain separate')
(root/'曲线说明.md').write_text('''# 人口与粮食曲线口径

两路CSV来自每15秒的只读浏览器观察，不插值补数据，不注入模拟时间。墙钟与600模拟秒一年的纪年分列，倍率与暂停单独保留。

人口分别列起源城、普查已经显示的人口与全世界真实底账；已显示名册也包括独立合作城市，不能一概称为被本国治理。地区和片区在接触前也真实存在；其仓库存量不等于玩家已可支配的物资。因此粮食按原镇、三个片区、第二/第三城、北陆/东陆本地、国家与先进工区分别列示，绝不加总成一个可用粮仓。空项表示该阶段尚无对应账册。

自始至终原始观察保留在各自timeline.ndjson。规则修复/原生重读的边界见候选冻结.json；曲线不去掉不利结果。
''')
