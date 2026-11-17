// Dados estruturados dos treinos e catálogo biomecânico 3D

export const EXERCISE_CATALOG = {
  ankle_rotation: {
    id: 'ankle_rotation',
    name: 'Rotação dos tornozelos',
    category: 'aquecimento',
    anim: 'ankle_rotation',
    prop: 'none',
    defaultCamera: 'front',
    muscles: ['calves'],
    musclesLabel: 'Tornozelos, Pés e Panturrilha',
    steps: [
      'Fique em pé com a postura ereta e transfira o peso para uma perna.',
      'Eleve ligeiramente o outro pé à frente, mantendo a ponta do pé livre.',
      'Faça movimentos circulares amplos com o tornozelo para os dois lados e troque de pé.'
    ],
    tip: 'Mantenha o joelho relaxado e gire apenas a articulação do tornozelo, sem balançar o quadril.'
  },
  hip_rotation: {
    id: 'hip_rotation',
    name: 'Rotação do quadril',
    category: 'aquecimento',
    anim: 'hip_rotation',
    prop: 'none',
    defaultCamera: 'threeQuarter',
    muscles: ['hips', 'core'],
    musclesLabel: 'Quadril, Lombar e Core',
    steps: [
      'Afaste os pés na largura dos ombros e apoie as mãos na cintura.',
      'Desenhe círculos amplos e suaves com o quadril em sentido horário.',
      'Repita o mesmo número de voltas para o sentido anti-horário.'
    ],
    tip: 'Mantenha os ombros relativamente estáveis e os pés firmes no chão.'
  },
  leg_swing: {
    id: 'leg_swing',
    name: 'Balanço das pernas',
    category: 'aquecimento',
    anim: 'leg_swing',
    prop: 'none',
    defaultCamera: 'side',
    muscles: ['hips', 'hamstrings', 'quads'],
    musclesLabel: 'Flexores do Quadril e Posteriores',
    steps: [
      'Apoie o peso em uma perna (pode segurar em uma parede/cadeira se precisar).',
      'Balance a outra perna estendida para frente e para trás de forma controlada.',
      'Faça 10 balanços em cada perna sem forçar a lombar.'
    ],
    tip: 'Evite arquear as costas quando a perna for para trás; o movimento vem do quadril.'
  },
  arm_circles: {
    id: 'arm_circles',
    name: 'Rotação dos braços',
    category: 'aquecimento',
    anim: 'arm_circles',
    prop: 'none',
    defaultCamera: 'front',
    muscles: ['shoulders', 'arms'],
    musclesLabel: 'Ombros e Parte Superior das Costas',
    steps: [
      'Em pé, estenda os dois braços lateralmente na altura dos ombros.',
      'Realize giros circulares controlados com os braços para frente e depois para trás.',
      'Mantenha o pescoço relaxado e o abdômen levemente ativo.'
    ],
    tip: 'Não encolha os ombros em direção às orelhas durante as rotações.'
  },
  high_knees: {
    id: 'high_knees',
    name: 'Marcha elevando os joelhos',
    category: 'aquecimento',
    anim: 'high_knees',
    prop: 'none',
    defaultCamera: 'threeQuarter',
    muscles: ['quads', 'hips', 'core'],
    musclesLabel: 'Quadríceps, Quadril, Core e Cardio',
    steps: [
      'Marche no lugar elevando um joelho de cada vez até a linha do quadril.',
      'Alterne o movimento dos braços acompanhando o ritmo das pernas.',
      'Mantenha o tronco ereto e aterrisse de forma leve na ponta dos pés.'
    ],
    tip: 'Respire em ritmo constante e evite inclinar o tronco para trás ao subir o joelho.'
  },
  treadmill: {
    id: 'treadmill',
    name: 'Esteira',
    category: 'esteira',
    anim: 'treadmill',
    prop: 'treadmill',
    defaultCamera: 'side',
    muscles: ['quads', 'calves', 'glutes', 'core'],
    musclesLabel: 'Cardiorrespiratório, Pernas e Glúteos',
    steps: [
      'Ajuste a velocidade da esteira conforme a etapa atual (caminhada leve, moderada ou trote).',
      'Mantenha olhar à frente, ombros relaxados e braços dobrados a ~90° balançando naturalmente.',
      'Pise próximo ao centro da lona evitando segurar o tempo todo nos apoios.'
    ],
    tip: 'Se estiver confortável na caminhada, pode usar inclinação entre 0% e 1%. Se sentir dor, reduza para caminhada leve.'
  },
  squat: {
    id: 'squat',
    name: 'Agachamento',
    category: 'exercicio',
    anim: 'squat',
    prop: 'none',
    defaultCamera: 'threeQuarter',
    muscles: ['quads', 'glutes', 'core'],
    musclesLabel: 'Quadríceps, Glúteos e Core',
    steps: [
      'Posicione os pés na largura dos ombros com as pontas levemente voltadas para fora.',
      'Leve o quadril para trás e flexione os joelhos descendo como se fosse sentar, estendendo os braços à frente para equilíbrio.',
      'Empurre o chão pelos calcanhares para retornar à posição inicial mantendo a coluna neutra.'
    ],
    tip: 'Não deixe os joelhos entrarem para dentro e mantenha os calcanhares apoiados no chão.'
  },
  wall_pushup: {
    id: 'wall_pushup',
    name: 'Flexão na parede',
    category: 'exercicio',
    anim: 'wall_pushup',
    prop: 'wall',
    defaultCamera: 'side',
    muscles: ['chest', 'arms', 'shoulders', 'core'],
    musclesLabel: 'Peitoral, Tríceps, Ombros e Core',
    steps: [
      'Fique de frente para a parede, dê um passo para trás e apoie as palmas na largura dos ombros.',
      'Mantenha o corpo alinhado da cabeça aos calcanhares e flexione os cotovelos levando o peito em direção à parede.',
      'Empurre a parede estendendo os braços de forma controlada até voltar à posição inicial.'
    ],
    tip: 'Mantenha os cotovelos apontando levemente para baixo (em ~45°) e não deixe o quadril cair.'
  },
  glute_bridge: {
    id: 'glute_bridge',
    name: 'Elevação de quadril',
    category: 'exercicio',
    anim: 'glute_bridge',
    prop: 'mat',
    defaultCamera: 'side',
    muscles: ['glutes', 'hamstrings', 'core'],
    musclesLabel: 'Glúteos, Posteriores de Coxa e Lombar',
    steps: [
      'Deite-se de barriga para cima no tapete, joelhos dobrados e pés apoiados na largura do quadril.',
      'Com os braços ao lado do corpo, pressione os calcanhares no chão e eleve o quadril até alinhar joelhos, quadril e ombros.',
      'Contraia os glúteos no topo por 1 segundo e desça devagar sem despencar.'
    ],
    tip: 'Evite empurrar com a lombar exageradamente; foque a força nos glúteos e calcanhares.'
  },
  bird_dog: {
    id: 'bird_dog',
    name: 'Bird dog',
    category: 'exercicio',
    anim: 'bird_dog',
    prop: 'mat',
    defaultCamera: 'threeQuarter',
    muscles: ['core', 'back', 'glutes', 'shoulders'],
    musclesLabel: 'Core, Lombar, Glúteos e Estabilizadores',
    steps: [
      'Fique em quatro apoios no tapete: mãos alinhadas abaixo dos ombros e joelhos abaixo do quadril.',
      'Estenda simultaneamente um braço à frente e a perna oposta para trás até ficarem alinhados com o tronco.',
      'Segure brevemente mantendo o quadril nivelado, retorne ao apoio e alterne (ou complete 10 por lado).'
    ],
    tip: 'Não gire o quadril nem afunde a lombar; imagine equilibrar um copo d’água nas costas.'
  },
  dead_bug: {
    id: 'dead_bug',
    name: 'Dead bug',
    category: 'exercicio',
    anim: 'dead_bug',
    prop: 'mat',
    defaultCamera: 'threeQuarter',
    muscles: ['core'],
    musclesLabel: 'Abdômen Profundo e Estabilidade Lombar',
    steps: [
      'Deite-se de costas no tapete, eleve os braços estendidos ao teto e dobre quadris e joelhos a 90°.',
      'Mantendo a lombar encostada no chão, abaixe lentamente um braço para trás enquanto estende a perna oposta próxima ao solo.',
      'Retorne ao centro de forma controlada e repita alternando os lados.'
    ],
    tip: 'Se a lombar começar a descolar do chão, desça a perna um pouco menos.'
  },
  knee_plank: {
    id: 'knee_plank',
    name: 'Prancha com joelhos apoiados',
    category: 'exercicio',
    anim: 'knee_plank',
    prop: 'mat',
    defaultCamera: 'side',
    muscles: ['core', 'shoulders', 'arms'],
    musclesLabel: 'Abdômen, Core e Ombros',
    steps: [
      'Apoie as mãos no tapete alinhadas abaixo dos ombros e apoie os joelhos atrás da linha do quadril.',
      'Alinhe cabeça, tronco e quadris em uma linha reta diagonal, contraindo o abdômen e os glúteos.',
      'Sustente a posição pelo tempo marcado respirando de forma contínua.'
    ],
    tip: 'Não deixe o quadril cair para baixo nem empinado para cima.'
  },
  crunch: {
    id: 'crunch',
    name: 'Abdominal curto',
    category: 'exercicio',
    anim: 'crunch',
    prop: 'mat',
    defaultCamera: 'side',
    muscles: ['core'],
    musclesLabel: 'Reto Abdominal',
    steps: [
      'Deite-se de costas com os joelhos dobrados, pés firmes no chão e mãos apoiadas levemente atrás da cabeça.',
      'Solte o ar enquanto contrai o abdômen e eleva apenas os ombros e a parte superior das costas do chão.',
      'Retorne devagar inspirando sem relaxar totalmente entre as repetições.'
    ],
    tip: 'Não puxe o pescoço com as mãos; mantenha o queixo afastado do peito olhando na diagonal para cima.'
  },
  side_plank: {
    id: 'side_plank',
    name: 'Prancha lateral',
    category: 'exercicio',
    anim: 'side_plank',
    prop: 'mat',
    defaultCamera: 'front',
    muscles: ['core', 'hips', 'shoulders'],
    musclesLabel: 'Oblíquos, Core Lateral e Ombro',
    steps: [
      'Deite-se de lado no tapete apoiando o antebraço diretamente abaixo do ombro e pernas estendidas.',
      'Eleve o quadril do chão formando uma linha reta dos pés até a cabeça, apoiando a mão livre na cintura.',
      'Mantenha o tempo indicado e repita do outro lado.'
    ],
    tip: 'Mantenha o quadril elevado e não deixe o ombro de apoio colapsar em direção à orelha.'
  },
  chair_squat: {
    id: 'chair_squat',
    name: 'Agachamento com cadeira',
    category: 'exercicio',
    anim: 'chair_squat',
    prop: 'chair',
    defaultCamera: 'threeQuarter',
    muscles: ['quads', 'glutes', 'core'],
    musclesLabel: 'Quadríceps, Glúteos e Estabilidade',
    steps: [
      'Posicione-se em pé de costas para uma cadeira firme, pés na largura dos ombros.',
      'Projete o quadril para trás e agache devagar até tocar suavemente o assento (sem despencar).',
      'Com os braços estendidos à frente, faça força nos calcanhares para subir imediatamente.'
    ],
    tip: 'Use a cadeira apenas como referência de profundidade, mantendo a tensão muscular.'
  },
  lateral_leg_raise: {
    id: 'lateral_leg_raise',
    name: 'Elevação lateral das pernas',
    category: 'exercicio',
    anim: 'lateral_leg_raise',
    prop: 'none',
    defaultCamera: 'front',
    muscles: ['glutes', 'hips'],
    musclesLabel: 'Glúteo Médio e Abdutores do Quadril',
    steps: [
      'Em pé com a postura alinhada (pode apoiar a mão em uma parede ou cadeira se desejar), firme o peso em uma perna.',
      'Eleve a outra perna estendida para a lateral de forma controlada sem inclinar o tronco.',
      'Desça devagar sem encostar com força e complete as repetições de cada lado.'
    ],
    tip: 'Mantenha a ponta do pé voltada para frente e o tronco firme, evitando tombar para o lado oposto.'
  },
  calf_raise: {
    id: 'calf_raise',
    name: 'Panturrilha',
    category: 'exercicio',
    anim: 'calf_raise',
    prop: 'none',
    defaultCamera: 'side',
    muscles: ['calves'],
    musclesLabel: 'Panturrilhas e Tornozelos',
    steps: [
      'Fique em pé com os pés paralelos na largura do quadril e coluna ereta.',
      'Suba na ponta dos pés elevando os calcanhares o máximo possível de forma controlada.',
      'Segure 1 segundo no alto e desça os calcanhares devagar até o chão.'
    ],
    tip: 'Evite dobrar os joelhos ou jogar o corpo para frente durante a subida.'
  },
  side_steps: {
    id: 'side_steps',
    name: 'Passos laterais',
    category: 'exercicio',
    anim: 'side_steps',
    prop: 'none',
    defaultCamera: 'front',
    muscles: ['quads', 'glutes', 'hips', 'calves'],
    musclesLabel: 'Cardio, Glúteos, Pernas e Agilidade',
    steps: [
      'Mantenha os joelhos levemente flexionados em base atlética e o tronco firme.',
      'Dê um passo amplo para a direita aproximando o outro pé, depois volte com passo amplo para a esquerda.',
      'Mantenha ritmo constante e fluido durante os 30 segundos.'
    ],
    tip: 'Mantenha o peso nos meios-pés para agilidade e não cruze as pernas.'
  },
  torso_twist: {
    id: 'torso_twist',
    name: 'Rotação de tronco',
    category: 'exercicio',
    anim: 'torso_twist',
    prop: 'none',
    defaultCamera: 'front',
    muscles: ['core', 'back'],
    musclesLabel: 'Oblíquos, Core e Mobilidade Torácica',
    steps: [
      'Em pé com os pés afastados na largura dos ombros, dobre os cotovelos com as mãos próximas ao peito.',
      'Gire o tronco de forma controlada para um lado e depois para o outro acompanhando com a cabeça.',
      'Mantenha o abdômen firme e o quadril estável voltado para frente.'
    ],
    tip: 'Evite movimentos bruscos; controle a rotação tanto na ida quanto na volta.'
  },
  lateral_arm_raise: {
    id: 'lateral_arm_raise',
    name: 'Elevação lateral dos braços',
    category: 'exercicio',
    anim: 'lateral_arm_raise',
    prop: 'none',
    defaultCamera: 'front',
    muscles: ['shoulders', 'arms'],
    musclesLabel: 'Ombros (Deltóides) e Braços',
    steps: [
      'Em pé com a coluna alinhada e abdômen contraído, deixe os braços relaxados ao lado do corpo.',
      'Eleve os dois braços lateralmente até a linha dos ombros mantendo os cotovelos levemente destravados.',
      'Desça devagar controlando o movimento sem deixar os braços caírem.'
    ],
    tip: 'Não eleve os braços acima dos ombros nem dê impulso balançando o tronco.'
  },
  quad_stretch: {
    id: 'quad_stretch',
    name: 'Quadríceps',
    category: 'alongamento',
    anim: 'quad_stretch',
    prop: 'none',
    defaultCamera: 'side',
    muscles: ['quads'],
    musclesLabel: 'Alongamento de Quadríceps (Frente da Coxa)',
    steps: [
      'Em pé, dobre um joelho para trás e segure o pé ou tornozelo com a mão do mesmo lado.',
      'Aproxime suavemente o calcanhar do glúteo mantendo os joelhos próximos um do outro.',
      'Sustente por 30 segundos respirando fundo e depois repita na outra perna.'
    ],
    tip: 'Mantenha a coluna ereta e não deixe o joelho flexionado abrir para o lado.'
  },
  hamstring_stretch: {
    id: 'hamstring_stretch',
    name: 'Posterior da coxa',
    category: 'alongamento',
    anim: 'hamstring_stretch',
    prop: 'bench',
    defaultCamera: 'side',
    muscles: ['hamstrings', 'calves'],
    musclesLabel: 'Alongamento de Posteriores de Coxa',
    steps: [
      'Fique em pé de frente para um banco ou degrau firme e apoie um calcanhar sobre o apoio com a perna estendida.',
      'Com as mãos na cintura e a coluna reta, incline o tronco suavemente para frente partindo do quadril.',
      'Mantenha por 30 segundos sentindo alongar atrás da coxa e troque de perna.'
    ],
    tip: 'Evite arredondar demais as costas; prefira inclinar a partir do quadril com peito aberto.'
  },
  calf_stretch: {
    id: 'calf_stretch',
    name: 'Panturrilha',
    category: 'alongamento',
    anim: 'calf_raise',
    prop: 'none',
    defaultCamera: 'side',
    muscles: ['calves'],
    musclesLabel: 'Panturrilhas e Tornozelos',
    steps: [
      'Fique em pé com os pés paralelos na largura do quadril e postura alinhada.',
      'Suba suavemente na ponta dos dois pés elevando os calcanhares ao máximo.',
      'Segure brevemente no topo e desça os calcanhares devagar até encostar no chão.'
    ],
    tip: 'Suba e desça de forma controlada sem dobrar os joelhos.'
  },
  hip_flexor_stretch: {
    id: 'hip_flexor_stretch',
    name: 'Flexor do quadril',
    category: 'alongamento',
    anim: 'hip_flexor_stretch',
    prop: 'mat',
    defaultCamera: 'threeQuarter',
    muscles: ['hips', 'quads'],
    musclesLabel: 'Alongamento de Flexores do Quadril (Iliopsoas)',
    steps: [
      'Ajoelhe-se com uma perna no tapete e apoie o outro pé à frente formando ângulo de 90° no joelho.',
      'Mantendo o tronco ereto e as mãos no joelho da frente ou cintura, avance suavemente o quadril para frente.',
      'Sustente por 30 segundos sentindo a parte frontal do quadril da perna de trás e troque de lado.'
    ],
    tip: 'Não arqueie a lombar para trás; ative levemente o abdômen durante a posição.'
  },
  chest_stretch: {
    id: 'chest_stretch',
    name: 'Peitoral',
    category: 'alongamento',
    anim: 'chest_stretch',
    prop: 'doorframe',
    defaultCamera: 'front',
    muscles: ['chest', 'shoulders'],
    musclesLabel: 'Alongamento de Peitoral e Ombro Anterior',
    steps: [
      'Fique em pé ao lado de uma parede ou batente e estenda um braço lateralmente na altura do ombro apoiando a palma.',
      'Gire suavemente o peito e os ombros para o lado oposto até sentir abrir a região peitoral.',
      'Respire fundo sustentando 30 segundos (pode fazer os dois lados para equilíbrio).'
    ],
    tip: 'Mantenha o ombro relaxado para baixo e evite forçar além de um alongamento confortável.'
  },
  rest_day: {
    id: 'rest_day',
    name: 'Dia de Descanso',
    category: 'descanso',
    anim: 'rest_day',
    prop: 'none',
    defaultCamera: 'threeQuarter',
    muscles: ['core'],
    musclesLabel: 'Recuperação Muscular e Hidratação',
    steps: [
      'Hoje o corpo consolida os ganhos da semana e recupera músculos e articulações.',
      'Se quiser, faça uma caminhada leve ao ar livre e mantenha boa hidratação ao longo do dia.',
      'Respeite seus limites e prepare-se para a próxima sessão.'
    ],
    tip: 'O descanso faz parte do treino: dormir bem e hidratar potencializam sua evolução.'
  }
};

export const PROFILES = {
  marcos: {
    id: 'marcos',
    name: 'Marcos',
    badge: 'Treino Ativo',
    title: 'Minha Planilha de Treino Semanal',
    subtitle: 'Esteira + Exercícios Complementares',
    tagline: 'Mais saúde • Mais disposição • Sua melhor versão!',
    theme: 'emerald',
    ready: true,
    treadmillProgression: [
      { week: 1, label: '1ª Semana', walkSpeed: 4.5, jogSpeed: 5.5 },
      { week: 2, label: '2ª Semana', walkSpeed: 4.5, jogSpeed: 6.0 },
      { week: 3, label: '3ª Semana', walkSpeed: 5.0, jogSpeed: 6.0 },
      { week: 4, label: '4ª Semana', walkSpeed: 5.0, jogSpeed: 6.5 }
    ],
    treadmillProgressionNote: 'Se estiver confortável, pode aumentar a inclinação (0–1%) na caminhada.',
    warmup: {
      title: 'Antes de começar: Alongamento Dinâmico',
      durationLabel: '5 min',
      items: [
        { uid: 'w_ankle', exerciseId: 'ankle_rotation', prescription: '10x cada', timerType: 'stopwatch', sets: 2, reps: 10, perSide: true },
        { uid: 'w_hip', exerciseId: 'hip_rotation', prescription: '10x cada', timerType: 'stopwatch', sets: 2, reps: 10, perSide: true },
        { uid: 'w_swing', exerciseId: 'leg_swing', prescription: '10x cada', timerType: 'stopwatch', sets: 2, reps: 10, perSide: true },
        { uid: 'w_arms', exerciseId: 'arm_circles', prescription: '15x', timerType: 'stopwatch', sets: 1, reps: 15, perSide: false },
        { uid: 'w_march', exerciseId: 'high_knees', prescription: '1 min', timerType: 'countdown', seconds: 60, sets: 1, perSide: false }
      ]
    },
    cooldown: {
      title: 'Alongamento Depois do Treino',
      durationLabel: '5 a 7 min',
      items: [
        { uid: 'c_quad', exerciseId: 'quad_stretch', prescription: '30s por perna', timerType: 'countdown', seconds: 30, sets: 1, perSide: true },
        { uid: 'c_ham', exerciseId: 'hamstring_stretch', prescription: '30s por perna', timerType: 'countdown', seconds: 30, sets: 1, perSide: true },
        { uid: 'c_calf', exerciseId: 'calf_stretch', prescription: '30s por perna', timerType: 'countdown', seconds: 30, sets: 1, perSide: true },
        { uid: 'c_hip', exerciseId: 'hip_flexor_stretch', prescription: '30s por perna', timerType: 'countdown', seconds: 30, sets: 1, perSide: true },
        { uid: 'c_chest', exerciseId: 'chest_stretch', prescription: '30s', timerType: 'countdown', seconds: 30, sets: 1, perSide: false }
      ]
    },
    days: [
      {
        id: 'segunda',
        weekdayIndex: 1,
        shortName: 'Seg',
        name: 'Segunda-feira',
        focus: 'Corpo Inteiro',
        schedule: 'Manhã – 07h às 08h',
        accent: '#22c55e',
        isRest: false,
        treadmill: {
          durationMin: 25,
          stages: [
            { uid: 'seg_t1', minutes: 5, speed: 3.0, kind: 'aquecimento', label: 'Aquecimento leve' },
            { uid: 'seg_t2', minutes: 5, speed: 4.5, kind: 'caminhada', label: 'Caminhada ativa' },
            { uid: 'seg_t3', minutes: 3, speed: 5.5, kind: 'trote', label: 'Trote moderado' },
            { uid: 'seg_t4', minutes: 5, speed: 4.5, kind: 'caminhada', label: 'Caminhada ativa' },
            { uid: 'seg_t5', minutes: 3, speed: 5.5, kind: 'trote', label: 'Trote moderado' },
            { uid: 'seg_t6', minutes: 4, speed: 3.0, kind: 'desaquecimento', label: 'Desaquecimento' }
          ]
        },
        exercisesDurationMin: 15,
        exercises: [
          { uid: 'seg_e1', exerciseId: 'squat', prescription: '2 x 12', timerType: 'stopwatch', sets: 2, reps: 12, perSide: false },
          { uid: 'seg_e2', exerciseId: 'wall_pushup', prescription: '2 x 12', timerType: 'stopwatch', sets: 2, reps: 12, perSide: false },
          { uid: 'seg_e3', exerciseId: 'glute_bridge', prescription: '2 x 15', timerType: 'stopwatch', sets: 2, reps: 15, perSide: false },
          { uid: 'seg_e4', exerciseId: 'bird_dog', prescription: '2 x 10 por lado', timerType: 'stopwatch', sets: 2, reps: 10, perSide: true }
        ]
      },
      {
        id: 'terca',
        weekdayIndex: 2,
        shortName: 'Ter',
        name: 'Terça-feira',
        focus: 'Abdômen',
        schedule: 'Noite',
        accent: '#3b82f6',
        isRest: false,
        treadmill: {
          durationMin: 25,
          stages: [
            { uid: 'ter_t1', minutes: 5, speed: 3.0, kind: 'aquecimento', label: 'Aquecimento leve' },
            { uid: 'ter_t2', minutes: 15, speed: 4.5, kind: 'caminhada', label: 'Caminhada contínua' },
            { uid: 'ter_t3', minutes: 5, speed: 3.0, kind: 'desaquecimento', label: 'Desaquecimento' }
          ]
        },
        exercisesDurationMin: 10,
        exercises: [
          { uid: 'ter_e1', exerciseId: 'dead_bug', prescription: '2 x 10', timerType: 'stopwatch', sets: 2, reps: 10, perSide: false },
          { uid: 'ter_e2', exerciseId: 'knee_plank', prescription: '2 x 20 seg', timerType: 'countdown', seconds: 20, sets: 2, perSide: false },
          { uid: 'ter_e3', exerciseId: 'crunch', prescription: '2 x 12', timerType: 'stopwatch', sets: 2, reps: 12, perSide: false },
          { uid: 'ter_e4', exerciseId: 'side_plank', prescription: '2 x 15 seg (cada lado)', timerType: 'countdown', seconds: 15, sets: 2, perSide: true }
        ]
      },
      {
        id: 'quarta',
        weekdayIndex: 3,
        shortName: 'Qua',
        name: 'Quarta-feira',
        focus: 'Pernas e Glúteos',
        schedule: 'Noite',
        accent: '#ec4899',
        isRest: false,
        treadmill: {
          durationMin: 20,
          stages: [
            { uid: 'qua_t1', minutes: 5, speed: 3.0, kind: 'aquecimento', label: 'Aquecimento leve' },
            { uid: 'qua_t2', minutes: 10, speed: 4.0, kind: 'caminhada_leve', label: 'Caminhada moderada' },
            { uid: 'qua_t3', minutes: 5, speed: 3.0, kind: 'desaquecimento', label: 'Desaquecimento' }
          ]
        },
        exercisesDurationMin: 15,
        exercises: [
          { uid: 'qua_e1', exerciseId: 'chair_squat', prescription: '2 x 12', timerType: 'stopwatch', sets: 2, reps: 12, perSide: false },
          { uid: 'qua_e2', exerciseId: 'glute_bridge', prescription: '2 x 15', timerType: 'stopwatch', sets: 2, reps: 15, perSide: false },
          { uid: 'qua_e3', exerciseId: 'lateral_leg_raise', prescription: '2 x 12 (cada)', timerType: 'stopwatch', sets: 2, reps: 12, perSide: true },
          { uid: 'qua_e4', exerciseId: 'calf_raise', prescription: '2 x 15', timerType: 'stopwatch', sets: 2, reps: 15, perSide: false }
        ]
      },
      {
        id: 'quinta',
        weekdayIndex: 4,
        shortName: 'Qui',
        name: 'Quinta-feira',
        focus: 'Cardio e Resistência',
        schedule: 'Manhã – 07h às 08h',
        accent: '#10b981',
        isRest: false,
        treadmill: {
          durationMin: 25,
          stages: [
            { uid: 'qui_t1', minutes: 5, speed: 3.0, kind: 'aquecimento', label: 'Aquecimento leve' },
            { uid: 'qui_t2', minutes: 5, speed: 4.5, kind: 'caminhada', label: 'Caminhada ativa' },
            { uid: 'qui_t3', minutes: 5, speed: 4.5, kind: 'caminhada', label: 'Caminhada contínua' },
            { uid: 'qui_t4', minutes: 3, speed: 5.5, kind: 'trote', label: 'Trote moderado' },
            { uid: 'qui_t5', minutes: 4, speed: 3.0, kind: 'desaquecimento', label: 'Desaquecimento' }
          ]
        },
        exercisesDurationMin: 15,
        exercises: [
          { uid: 'qui_e1', exerciseId: 'high_knees', prescription: '2 x 30 seg', timerType: 'countdown', seconds: 30, sets: 2, perSide: false },
          { uid: 'qui_e2', exerciseId: 'side_steps', prescription: '2 x 30 seg', timerType: 'countdown', seconds: 30, sets: 2, perSide: false },
          { uid: 'qui_e3', exerciseId: 'torso_twist', prescription: '2 x 15', timerType: 'stopwatch', sets: 2, reps: 15, perSide: false },
          { uid: 'qui_e4', exerciseId: 'bird_dog', prescription: '2 x 10 por lado', timerType: 'stopwatch', sets: 2, reps: 10, perSide: true }
        ]
      },
      {
        id: 'sexta',
        weekdayIndex: 5,
        shortName: 'Sex',
        name: 'Sexta-feira',
        focus: 'Parte Superior',
        schedule: 'Noite',
        accent: '#8b5cf6',
        isRest: false,
        treadmill: {
          durationMin: 20,
          stages: [
            { uid: 'sex_t1', minutes: 5, speed: 3.0, kind: 'aquecimento', label: 'Aquecimento leve' },
            { uid: 'sex_t2', minutes: 10, speed: 4.5, kind: 'caminhada', label: 'Caminhada ativa' },
            { uid: 'sex_t3', minutes: 5, speed: 3.0, kind: 'desaquecimento', label: 'Desaquecimento' }
          ]
        },
        exercisesDurationMin: 15,
        exercises: [
          { uid: 'sex_e1', exerciseId: 'wall_pushup', prescription: '2 x 12', timerType: 'stopwatch', sets: 2, reps: 12, perSide: false },
          { uid: 'sex_e2', exerciseId: 'lateral_arm_raise', prescription: '2 x 12', timerType: 'stopwatch', sets: 2, reps: 12, perSide: false },
          { uid: 'sex_e3', exerciseId: 'bird_dog', prescription: '2 x 10 por lado', timerType: 'stopwatch', sets: 2, reps: 10, perSide: true },
          { uid: 'sex_e4', exerciseId: 'squat', prescription: '2 x 12', timerType: 'stopwatch', sets: 2, reps: 12, perSide: false, customName: 'Agachamento livre' }
        ]
      },
      {
        id: 'sabado',
        weekdayIndex: 6,
        shortName: 'Sáb',
        name: 'Sábado',
        focus: 'Descanso',
        schedule: 'Recuperação Ativa',
        accent: '#64748b',
        isRest: true,
        treadmill: null,
        exercisesDurationMin: 0,
        exercises: []
      },
      {
        id: 'domingo',
        weekdayIndex: 0,
        shortName: 'Dom',
        name: 'Domingo',
        focus: 'Descanso',
        schedule: 'Recuperação Total',
        accent: '#64748b',
        isRest: true,
        treadmill: null,
        exercisesDurationMin: 0,
        exercises: []
      }
    ],
    objective: 'Criar o hábito, evoluir o condicionamento e cuidar de você!',
    tips: [
      'Comece com intensidade leve a moderada.',
      'Se sentir dor, reduza a velocidade ou faça apenas caminhada.',
      'Mantenha a postura correta na esteira.',
      'Beba água antes, durante e depois do treino.',
      'Respeite seus limites e celebre suas conquistas!'
    ]
  },
  esposa: {
    id: 'esposa',
    name: 'Esposa',
    badge: 'Em breve',
    title: 'Planilha da Esposa',
    subtitle: 'Pronta para receber o treino dela',
    tagline: 'Envie a imagem do treino da sua esposa para configurar tudo em 3D aqui!',
    theme: 'rose',
    ready: false
  }
};
