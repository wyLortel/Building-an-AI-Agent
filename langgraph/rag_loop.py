"""
LangGraph 입문 예제: "검색 → 문서 거르기 → 답변 생성 → 부족하면 다시 검색" 루프

전체 흐름 (그래프 모양):

    START
      │
      ▼
  [retrieve] ──▶ [grade_docs] ──▶ [generate]
      ▲                               │
      │                         decide_more()  ← 조건부 엣지 (분기 함수)
      │        "retrieve"             │
      └───────────────────────────────┤
                                      │ END
                                      ▼
                                     END

- 노드(node)   = 실제 일을 하는 함수. State를 받아서 "바뀐 부분"을 돌려준다.
- 엣지(edge)   = 노드 다음에 어디로 갈지 정하는 화살표.
- 조건부 엣지   = 함수의 반환값(문자열)에 따라 다음 노드를 고르는 화살표.
- State        = 모든 노드가 함께 들고 다니는 공용 메모장(딕셔너리).

API 키 없이 바로 실행되도록 검색/LLM은 가짜(fake) 함수로 만들어 두었다.
실행: python3 langgraph/rag_loop.py
"""

# ── 1. import ─────────────────────────────────────────────────────────────
from typing import TypedDict, List, Optional  # State의 "모양"을 타입으로 정의할 때 사용

from langgraph.graph import StateGraph, START, END  # 그래프 본체 + 시작/끝 표시용 특수 노드
from langgraph.checkpoint.memory import MemorySaver  # 실행 상태를 메모리에 저장(대화 기록 유지용)


# ── 2. State 정의 ─────────────────────────────────────────────────────────
# 그래프 안에서 노드들이 주고받는 데이터의 "설계도".
# 각 노드는 이 딕셔너리를 읽고, 바꾸고 싶은 키만 반환하면 된다.
class State(TypedDict):
    question: str          # 사용자의 질문 (처음에 입력으로 들어옴)
    docs: List[str]        # 검색해서 찾은 문서 목록
    answer: Optional[str]  # LLM이 만든 답변 (아직 없으면 None)
    retries: int           # 몇 번 검색했는지 세는 카운터 (무한루프 방지용)


# ── 3. 가짜 도구들 (실제 프로젝트에선 벡터DB / LLM 호출로 교체) ───────────────
# 아주 작은 "문서 저장소". 실제로는 Chroma, FAISS, Pinecone 같은 벡터DB가 이 역할을 한다.
FAKE_DB = [
    "LangGraph는 LLM 워크플로를 그래프(노드+엣지)로 표현하는 라이브러리다.",
    "StateGraph는 공용 State를 노드들이 순서대로 업데이트하는 그래프다.",
    "조건부 엣지를 쓰면 루프(반복)나 분기를 만들 수 있다.",
    "오늘 점심 메뉴는 김치찌개다.",  # ← 질문과 상관없는 '나쁜 문서' (grade_docs에서 걸러질 예정)
    "MemorySaver는 thread_id별로 실행 상태를 저장하는 체크포인터다.",
]


def search(question: str, retries: int) -> List[str]:
    """질문과 단어가 겹치는 문서를 찾는 흉내만 내는 검색 함수."""
    # 재시도할수록 더 많은 문서를 가져오도록 해서 "다시 검색하면 결과가 좋아지는" 상황을 연출
    top_k = 2 + retries * 2
    # 아주 단순한 검색: 문서를 순서대로 top_k개 가져온다
    return FAKE_DB[:top_k]


def filter_docs(docs: List[str]) -> List[str]:
    """관련 없는 문서를 버리는 함수 (실제로는 LLM에게 '이 문서 관련 있어?'라고 물어봄)."""
    # 'LangGraph', 'State', '엣지', 'MemorySaver' 같은 키워드가 있는 문서만 남긴다
    keywords = ["LangGraph", "State", "엣지", "MemorySaver"]
    return [d for d in docs if any(k in d for k in keywords)]


def llm_write(question: str, docs: List[str]) -> str:
    """LLM이 문서를 참고해서 답변을 쓰는 흉내."""
    # 문서들을 한 줄씩 이어붙여 '답변'처럼 만든다
    joined = "\n  - ".join(docs)
    return f"Q: {question}\n참고한 문서 {len(docs)}개:\n  - {joined}"


def is_good_enough(answer: Optional[str]) -> bool:
    """답변이 충분한지 판단 (실제로는 LLM-as-a-judge 등을 사용)."""
    # 여기서는 '참고 문서가 3개 이상이면 충분하다'는 단순 규칙
    return answer is not None and answer.count("\n  - ") >= 3


# ── 4. 노드 함수들 ─────────────────────────────────────────────────────────
# 규칙: (state) -> dict   ※ 반환한 키만 State에 덮어써진다. 나머지 키는 그대로 유지됨.

def retrieve(state: State) -> dict:
    """[노드 1] 질문으로 문서를 검색한다."""
    print(f"🔍 retrieve  (시도 {state['retries'] + 1}회차)")
    docs = search(state["question"], state["retries"])  # 검색 실행
    return {
        "docs": docs,                     # 찾은 문서를 State에 저장
        "retries": state["retries"] + 1,  # 검색 횟수 +1  ← 이걸 안 하면 무한루프 위험!
    }


def grade_docs(state: State) -> dict:
    """[노드 2] 품질 낮은(관련 없는) 문서를 제거한다."""
    good = filter_docs(state["docs"])  # 좋은 문서만 남김
    print(f"🧹 grade_docs ({len(state['docs'])}개 → {len(good)}개)")
    return {"docs": good}  # docs 키만 갱신


def generate(state: State) -> dict:
    """[노드 3] 남은 문서로 답변 초안을 만든다."""
    print("✍️  generate")
    answer = llm_write(state["question"], state["docs"])  # LLM 호출(가짜)
    return {"answer": answer}  # answer 키만 갱신


# ── 5. 분기 함수 (조건부 엣지용) ────────────────────────────────────────────
# ⚠️ 이건 "노드"가 아니다! State를 바꾸지 않고, "다음에 갈 곳의 이름"만 문자열로 돌려준다.
def decide_more(state: State) -> str:
    """답변이 충분하거나 재시도를 2번 넘게 했으면 끝, 아니면 다시 검색."""
    if is_good_enough(state["answer"]):   # 답변이 충분하면
        print("✅ 충분함 → END")
        return END                        # 그래프 종료
    if state["retries"] >= 3:             # 너무 많이 돌았으면 (안전장치)
        print("⛔ 재시도 한도 도달 → END")
        return END                        # 부족해도 그냥 종료
    print("🔁 부족함 → retrieve로 되돌아감")
    return "retrieve"                     # 다시 검색 노드로


# ── 6. 그래프 조립 ─────────────────────────────────────────────────────────
g = StateGraph(State)  # "이 그래프는 State 모양의 데이터를 들고 다닌다"고 선언

# 노드 등록: g.add_node("이름", 함수)
g.add_node("retrieve", retrieve)
g.add_node("grade_docs", grade_docs)
g.add_node("generate", generate)
# decide_more는 노드로 등록하지 않는다 → 아래에서 조건부 엣지로 연결

# 일반 엣지: A가 끝나면 무조건 B로
g.add_edge(START, "retrieve")          # 시작하면 retrieve부터
g.add_edge("retrieve", "grade_docs")   # retrieve → grade_docs
g.add_edge("grade_docs", "generate")   # grade_docs → generate

# 조건부 엣지: generate가 끝나면 decide_more()를 호출해서 그 반환값으로 다음 노드 결정
g.add_conditional_edges(
    "generate",                    # 출발 노드
    decide_more,                   # 분기 함수 (문자열 반환)
    ["retrieve", END],             # 갈 수 있는 목적지 목록 (그래프 그림 그릴 때도 쓰임)
)

# 컴파일: 설계도(g)를 실제로 실행 가능한 앱으로 만든다
memory = MemorySaver()                     # 실행 상태를 저장할 체크포인터
app = g.compile(checkpointer=memory)       # 체크포인터를 붙여서 컴파일


# ── 7. 실행 ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # 체크포인터를 쓰면 thread_id가 필수. 같은 thread_id면 이전 상태를 이어서 볼 수 있다.
    config = {"configurable": {"thread_id": "demo-1"}}

    # 초기 State: 모든 키를 채워서 넣어준다
    init: State = {
        "question": "LangGraph가 뭐야?",
        "docs": [],
        "answer": None,
        "retries": 0,
    }

    # invoke: 그래프를 END까지 끝까지 돌리고 최종 State를 돌려준다
    final = app.invoke(init, config)

    print("\n===== 최종 답변 =====")
    print(final["answer"])
    print(f"(총 검색 횟수: {final['retries']})")

    # 저장된 상태 확인: MemorySaver 덕분에 thread_id로 마지막 상태를 다시 꺼낼 수 있다
    snapshot = app.get_state(config)
    print(f"\n💾 저장된 상태의 retries 값: {snapshot.values['retries']}")

    # 보너스: 그래프 구조를 Mermaid 텍스트로 출력 (https://mermaid.live 에 붙여넣으면 그림으로 보임)
    print("\n===== 그래프 구조 (Mermaid) =====")
    print(app.get_graph().draw_mermaid())
