import os
import sys
sys.stdout.reconfigure(encoding='utf-8')

renames = {
    'きのえS.png': 'stem_kinoe.png',
    'きのえ.png': 'stem_kinoe.png',
    'きのと.png': 'stem_kinoto.png',
    'ひのえ.png': 'stem_hinoe.png',
    'ひのと.png': 'stem_hinoto.png',
    'つちのえ.png': 'stem_tsuchinoe.png',
    'つちのと.png': 'stem_tsuchinoto.png',
    'かのえS.png': 'stem_kanoe.png',
    'かのえ.png': 'stem_kanoe.png',
    'かのと.png': 'stem_kanoto.png',
    'みずのえ.png': 'stem_mizunoe.png',
    'みずのと.png': 'stem_mizunoto.png',
    'ねずみ.png': 'branch_ne.png',
    'うし.png': 'branch_ushi.png',
    'とら.png': 'branch_tora.png',
    'うさぎ.png': 'branch_u.png',
    'たつ.png': 'branch_tatsu.png',
    'み.png': 'branch_mi.png',
    'へび.png': 'branch_mi.png',
    'うま.png': 'branch_uma.png',
    'ひつじ.png': 'branch_hitsuji.png',
    'さる.png': 'branch_saru.png',
    'とり.png': 'branch_tori.png',
    'いぬ.png': 'branch_inu.png',
    'い.png': 'branch_i.png',
    'いのしし.png': 'branch_i.png',
}

img_dir = os.path.join(os.path.dirname(__file__), 'img')

for old_name, new_name in renames.items():
    old_path = os.path.join(img_dir, old_name)
    new_path = os.path.join(img_dir, new_name)
    if os.path.exists(old_path):
        os.rename(old_path, new_path)
        print(f'✅ {old_name} → {new_name}')
    else:
        print(f'⚠️ 見つかりません: {old_name}')

print('完了！')
