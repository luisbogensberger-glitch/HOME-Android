from pathlib import Path

path = Path('src/luis-home-app/app/src/main/assets/index.html')
text = path.read_text(encoding='utf-8')

card = r"""{id:'lean-startup',icon:'🚀',topic:'Entrepreneurship · The Lean Startup',time:'3 min',title:'Build–Measure–Learn: The Core Loop of The Lean Startup',hook:'A startup should not ask “Can we build this?” first. It should ask “What do we need to learn next?”',img:'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=80',lead:'Eric Ries treats a startup as an experiment under extreme uncertainty. Progress is not simply shipping more features; it is learning, with evidence, what customers actually value.',sections:[['Start with the risky assumption',`Every new venture rests on assumptions. Two especially important ones are the <b>value hypothesis</b>—whether the product creates enough value for customers—and the <b>growth hypothesis</b>—how adoption could spread. Instead of polishing a complete product first, identify the assumption that could kill the idea if it is wrong.`],['The MVP is a learning tool',`A <b>minimum viable product</b> is the smallest experiment that can produce useful evidence about a key assumption. “Minimum” does not mean careless or low quality. It means avoiding work that does not help answer the current question. Sometimes the MVP is software; sometimes it is a landing page, manual service, prototype or direct customer test.`],['Measure, then pivot or persevere',`After building the experiment, measure behaviour rather than relying only on compliments. Compare what happened with what you expected. If the evidence supports the underlying assumptions, improve and continue. If it repeatedly contradicts them, change an important part of the strategy—a <b>pivot</b>—while keeping what you have learned.`]],takeaway:'Build–Measure–Learn turns product development into a sequence of experiments: identify a risky assumption, test it cheaply, measure real behaviour and let the evidence shape the next move.',q:'What is the primary purpose of an MVP in Lean Startup thinking?',options:['To launch the cheapest possible finished product','To impress investors with as many features as possible','To test a key assumption and generate validated learning','To avoid speaking with customers until the product is polished'],correct:2,prompt:'For one idea you are working on, state one risky assumption and the smallest experiment that could test it.',keywords:['assumption','hypothesis','experiment','customer','test','evidence','learn','mvp','measure','pivot']},
"""

marker = "const cards=[\n"
if "id:'lean-startup'" not in text:
    if marker not in text:
        raise SystemExit('cards array marker not found')
    text = text.replace(marker, marker + card, 1)

old_state = "let tubeState=loadStore('tubeState',null);if(!tubeState||!Array.isArray(tubeState.activeIds)){tubeState={activeIds:cards.slice(0,5).map(c=>c.id),nextPoolIndex:5,completed:[],drafts:{}};saveStore('tubeState',tubeState)}"
new_state = "let tubeState=loadStore('tubeState',null);if(!tubeState||!Array.isArray(tubeState.activeIds)){tubeState={activeIds:cards.slice(0,6).map(c=>c.id),nextPoolIndex:6,completed:[],drafts:{},leanStartupAdded:true};saveStore('tubeState',tubeState)}else if(!tubeState.leanStartupAdded){if(!tubeState.activeIds.includes('lean-startup'))tubeState.activeIds.push('lean-startup');tubeState.leanStartupAdded=true;saveStore('tubeState',tubeState)}"
if old_state in text:
    text = text.replace(old_state, new_state, 1)
elif new_state not in text:
    raise SystemExit('tubeState initializer not found')

for old, new in {
    'Five short cards. Tap one, learn it, answer the quiz.': 'Six short cards. Tap one, learn it, answer the quiz.',
    '← All five cards': '← All six cards',
    'five fresh cards stay ready.': 'six fresh cards stay ready.',
    'Five ideas worth your attention.': 'Six ideas worth your attention.'
}.items():
    text = text.replace(old, new)

path.write_text(text, encoding='utf-8')
print('Lean Startup card added successfully')
