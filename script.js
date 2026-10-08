/* =====================================================
   바이브 카페 주문서 JavaScript
   파일: script.js
   설명: 실시간 금액 계산, 유효성 검사, 주문 확인 메시지 표시,
         탭 전환, 주문 내역 관리, Supabase 연동
   ===================================================== */


/* =====================================================
   0. Supabase 설정
   Supabase Dashboard → Project Settings → API 에서
   Project URL 과 anon public 키를 복사해서 아래에 붙여넣으세요.
   ===================================================== */

// 프로젝트 URL (예: https://xxxxxxxxxxxx.supabase.co)
const SUPABASE_URL = 'https://oeidphgmrehfgdsaajwn.supabase.co';

// 공개 익명 키 (anon / public) — 절대 service_role 키를 쓰지 마세요
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9laWRwaGdtcmVoZmdkc2FhanduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MDU3NjMsImV4cCI6MjEwNjk4MTc2M30.H44-lAk7EdFzfHYfs-J2OUu1rHZSsCixGgjAJHCFTso';

// Supabase 클라이언트 생성
// CDN으로 로드된 전역 supabase 객체의 createClient() 함수를 사용합니다.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


/* =====================================================
   1. HTML 요소 가져오기
   document.getElementById()로 id가 일치하는 요소를 변수에 저장해 둡니다.
   나중에 반복해서 쓸 때마다 새로 찾지 않아도 되어 편리합니다.
   ===================================================== */

// 폼 전체
const form = document.getElementById('order-form');

// 입력 요소들
const nameInput     = document.getElementById('customer-name');   // 이름
const phoneInput    = document.getElementById('customer-phone');  // 전화번호
const drinkSelect   = document.getElementById('drink-select');    // 음료 드롭다운
const quantityInput = document.getElementById('quantity');        // 수량
const requestInput  = document.getElementById('request');         // 요청사항

// 사이즈 라디오 버튼 - name이 "size"인 것들을 NodeList로 한 번에 가져옴
const sizeRadios = document.querySelectorAll('input[name="size"]');

// 추가 옵션 체크박스 - name이 "options"인 것들을 NodeList로 가져옴
const optionCheckboxes = document.querySelectorAll('input[name="options"]');

// 예상 금액 숫자가 들어갈 <strong> 태그
const totalPriceEl = document.getElementById('total-price');

// 유효성 오류 메시지 영역
const nameError  = document.getElementById('name-error');
const drinkError = document.getElementById('drink-error');

// 주문 확인 메시지가 표시될 영역
const orderConfirm = document.getElementById('order-confirm');

// 주문하기 버튼 (저장 중 비활성화 제어용)
const btnSubmit = document.getElementById('btn-submit');

// ── 탭 관련 요소 ───────────────────────────────────────
// 탭 버튼들 (NodeList)
const tabBtns = document.querySelectorAll('.tab-btn');

// 탭 패널들 (NodeList)
const tabPanels = document.querySelectorAll('.tab-panel');

// 주문 건수 배지
const orderBadge = document.getElementById('order-badge');

// ── 주문 내역 탭 관련 요소 ─────────────────────────────
// 주문 카드들이 삽입될 목록 컨테이너
const ordersList = document.getElementById('orders-list');

// "아직 주문 내역이 없어요" 안내 문구
const ordersEmpty = document.getElementById('orders-empty');

// 합계 + 내역 모두 지우기 버튼 영역
const ordersSummary = document.getElementById('orders-summary');

// 총 주문 금액 텍스트 요소
const ordersTotal = document.getElementById('orders-total');

// "내역 모두 지우기" 버튼
const btnClearAll = document.getElementById('btn-clear-all');


/* =====================================================
   2. 주문 데이터 저장소
   orders 배열에 주문 객체를 push해서 관리합니다.
   orderCounter는 주문번호(#1, #2, ...)를 위한 증가 카운터입니다.
   ===================================================== */

// 접수된 주문들을 담는 배열 (최신 주문이 앞에 오도록 unshift로 추가)
let orders = [];

// 주문 번호 카운터 (주문마다 1씩 증가, 취소해도 번호는 줄지 않음)
let orderCounter = 0;


/* =====================================================
   3. 금액 계산 함수 - calculateTotal()
   이 함수 하나에서 모든 금액 계산을 담당합니다.
   각 항목의 data-price 속성 값(숫자)을 읽어서 합산합니다.
   ===================================================== */

function calculateTotal() {
  // ── 음료 가격 ──────────────────────────────────────
  // 현재 선택된 <option>의 data-price를 읽어옵니다.
  // 아직 음료를 고르지 않은 경우(value="") data-price="0" 이므로 0원입니다.
  const selectedOption = drinkSelect.options[drinkSelect.selectedIndex];
  const drinkPrice = parseInt(selectedOption.dataset.price, 10) || 0;
  // parseInt: 문자열 "3500"을 숫자 3500으로 변환 (10진수 기준)
  // || 0: dataset.price가 없거나 NaN이면 0으로 대체

  // ── 사이즈 추가 금액 ───────────────────────────────
  // 라디오 버튼 중 checked(선택된) 것을 찾아서 data-price를 읽습니다.
  let sizePrice = 0;
  sizeRadios.forEach(function (radio) {
    if (radio.checked) {
      sizePrice = parseInt(radio.dataset.price, 10) || 0;
    }
  });

  // ── 추가 옵션 합계 ─────────────────────────────────
  // 체크된 체크박스의 data-price를 모두 더합니다.
  let optionsPrice = 0;
  optionCheckboxes.forEach(function (checkbox) {
    if (checkbox.checked) {
      optionsPrice += parseInt(checkbox.dataset.price, 10) || 0;
    }
  });

  // ── 수량 ───────────────────────────────────────────
  // 수량 입력 값은 문자열이므로 parseInt로 숫자로 변환합니다.
  // 음수나 0이 되지 않도록 최소값 1을 보장합니다.
  const quantity = Math.max(1, parseInt(quantityInput.value, 10) || 1);

  // ── 최종 금액 계산 ─────────────────────────────────
  // (음료 가격 + 사이즈 추가 + 옵션 추가) × 수량
  const total = (drinkPrice + sizePrice + optionsPrice) * quantity;

  return total;
  // 반환값을 화면에 표시하는 것은 이 함수를 호출한 곳에서 처리합니다.
}


/* =====================================================
   4. 금액 화면 업데이트 함수 - updatePriceDisplay()
   calculateTotal()을 호출해서 결과를 화면에 표시합니다.
   toLocaleString()으로 천 단위 콤마를 자동으로 붙여줍니다.
   ===================================================== */

function updatePriceDisplay() {
  const total = calculateTotal();
  // toLocaleString('ko-KR'): 한국 로케일로 숫자 포맷 → 5000 → "5,000"
  totalPriceEl.textContent = total.toLocaleString('ko-KR');
}


/* =====================================================
   5. 실시간 이벤트 리스너 등록
   각 입력 요소가 바뀔 때마다 updatePriceDisplay()를 호출합니다.
   'change' 이벤트: 값이 바뀐 직후 발생
   'input'  이벤트: 입력하는 도중 실시간으로 발생
   ===================================================== */

// 음료 드롭다운이 바뀔 때
drinkSelect.addEventListener('change', updatePriceDisplay);

// 사이즈 라디오 버튼 각각에 이벤트 등록
sizeRadios.forEach(function (radio) {
  radio.addEventListener('change', updatePriceDisplay);
});

// 추가 옵션 체크박스 각각에 이벤트 등록
optionCheckboxes.forEach(function (checkbox) {
  checkbox.addEventListener('change', updatePriceDisplay);
});

// 수량이 바뀔 때 (input: 직접 타이핑할 때도 반응)
quantityInput.addEventListener('input', updatePriceDisplay);


/* =====================================================
   6. 유효성 검사 함수 - validateForm()
   이름과 음료 선택 여부를 검사합니다.
   문제가 있으면 오류 메시지를 보여주고 false를 반환합니다.
   모두 정상이면 오류 메시지를 지우고 true를 반환합니다.
   ===================================================== */

function validateForm() {
  let isValid = true; // 최종 검사 결과 (문제 없으면 true)

  // ── 이름 검사 ──────────────────────────────────────
  // trim(): 앞뒤 공백을 제거한 뒤 빈 문자열인지 확인
  if (nameInput.value.trim() === '') {
    nameError.textContent = '이름을 입력해주세요.';
    nameInput.focus(); // 입력칸에 커서를 자동으로 이동
    isValid = false;
  } else {
    nameError.textContent = ''; // 오류 없으면 메시지 초기화
  }

  // ── 음료 선택 검사 ─────────────────────────────────
  // 첫 번째 옵션(안내 텍스트)의 value가 "" 이므로, 여전히 ""이면 미선택 상태
  if (drinkSelect.value === '') {
    drinkError.textContent = '음료를 선택해주세요.';
    if (isValid) drinkSelect.focus(); // 이름이 이미 오류난 경우엔 커서 이동 안 함
    isValid = false;
  } else {
    drinkError.textContent = ''; // 오류 없으면 메시지 초기화
  }

  return isValid;
}


/* =====================================================
   7. 현재 폼에서 주문 데이터 읽기 - collectOrderData()
   폼의 현재 상태를 객체로 묶어 반환합니다.
   이 객체를 orders 배열에 저장하고, 카드 렌더링에도 사용합니다.
   ===================================================== */

function collectOrderData() {
  // 이름 (앞뒤 공백 제거)
  const name = nameInput.value.trim();

  // 전화번호 (앞뒤 공백 제거, 선택 항목이므로 빈 문자열일 수 있음)
  const phone = phoneInput.value.trim();

  // 선택된 음료 option 요소 (이름과 단품 가격 둘 다 여기서 가져옴)
  const selectedOption = drinkSelect.options[drinkSelect.selectedIndex];

  // 음료 이름 (option 텍스트에서 가격 부분 제거)
  // 예: "카페라떼 4,000원" → "카페라떼"
  const drinkName = selectedOption.text.replace(/\s*\d[\d,]*원$/, '').trim();

  // 음료 단품 가격 (data-price 속성, 숫자로 변환)
  const drinkPrice = parseInt(selectedOption.dataset.price, 10) || 0;

  // 선택된 사이즈 라디오의 value (S / M / L)
  let sizeValue = '';
  sizeRadios.forEach(function (radio) {
    if (radio.checked) sizeValue = radio.value;
  });

  // 체크된 추가 옵션들의 텍스트 수집
  const selectedOptions = [];
  optionCheckboxes.forEach(function (checkbox) {
    if (checkbox.checked) {
      // label 태그 안의 텍스트 중 가격 힌트(+xxx원)를 제거
      const labelEl = document.querySelector('label[for="' + checkbox.id + '"]');
      let optionText = labelEl ? labelEl.textContent.trim() : checkbox.value;
      optionText = optionText.replace(/\s*\+[\d,]+원$/, '').trim();
      selectedOptions.push(optionText);
    }
  });

  // 수량
  const qty = Math.max(1, parseInt(quantityInput.value, 10) || 1);

  // 요청사항
  const request = requestInput.value.trim();

  // 총 금액
  const total = calculateTotal();

  // 주문 시간 - 현재 시각을 "오전/오후 HH:MM" 형식으로 포맷
  const now = new Date();
  const timeStr = now.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // 주문 번호 증가
  orderCounter++;

  // 주문 데이터를 객체로 묶어 반환
  return {
    id:         orderCounter,
    name:       name,
    phone:      phone,          // 전화번호 (선택)
    drink:      drinkName,
    drinkPrice: drinkPrice,     // 음료 단품 가격
    size:       sizeValue,
    options:    selectedOptions,
    qty:        qty,
    request:    request,
    total:      total,
    time:       timeStr,
  };
}


/* =====================================================
   8. 주문 확인 메시지 생성 함수 - buildConfirmMessage()
   주문 데이터 객체를 받아 자연스러운 한국어 문장을 만들어 반환합니다.
   ===================================================== */

function buildConfirmMessage(order) {
  // 옵션이 있으면 괄호로 감쌈, 없으면 괄호 생략
  const optionsPart = order.options.length > 0
    ? ' (' + order.options.join(', ') + ')'
    : '';

  // 총 금액 천 단위 콤마 포맷
  const totalFormatted = order.total.toLocaleString('ko-KR');

  return (
    order.name + '님, ' +
    order.drink + ' ' + order.size + '사이즈' + optionsPart + ' ' +
    order.qty + '잔, ' +
    '총 ' + totalFormatted + '원 주문이 접수되었습니다! ☕'
  );
}


/* =====================================================
   9. 주문 내역 렌더링 함수 - renderOrders()
   orders 배열 전체를 순회하여 카드 목록을 새로 그립니다.
   이 함수 하나만 호출하면 화면이 항상 최신 상태로 갱신됩니다.
   ===================================================== */

function renderOrders() {
  // ── 기존 카드 목록 초기화 ──────────────────────────
  // 이전에 그려진 카드들을 모두 지웁니다.
  ordersList.textContent = '';

  // ── 주문이 없는 경우 ───────────────────────────────
  if (orders.length === 0) {
    ordersEmpty.classList.remove('hidden');   // 안내 문구 보이기
    ordersSummary.classList.add('hidden');    // 합계 영역 숨기기
    orderBadge.classList.add('hidden');       // 배지 숨기기
    return; // 더 이상 그릴 것이 없으므로 함수 종료
  }

  // ── 주문이 있는 경우 ───────────────────────────────
  ordersEmpty.classList.add('hidden');        // 안내 문구 숨기기
  ordersSummary.classList.remove('hidden');   // 합계 영역 보이기

  // 배지 업데이트 (건수 표시)
  orderBadge.textContent = orders.length;
  orderBadge.classList.remove('hidden');

  // ── 주문 카드 그리기 ──────────────────────────────
  // orders 배열의 각 항목을 카드로 변환해 목록에 추가합니다.
  orders.forEach(function (order) {
    // 카드 컨테이너 <div class="order-card">
    const card = document.createElement('div');
    card.className = 'order-card';

    // [1행] #번호 이름님 · 금액 ──────────────────────
    const titleEl = document.createElement('p');
    titleEl.className = 'order-card-title';
    // textContent로 삽입 → XSS(크로스사이트 스크립팅) 방지
    titleEl.textContent =
      '#' + order.id + ' ' + order.name + '님  ·  ' +
      order.total.toLocaleString('ko-KR') + '원';

    // [2행] 음료 M사이즈 (옵션) N잔 ──────────────────
    const drinkEl = document.createElement('p');
    drinkEl.className = 'order-card-drink';
    const optionsPart = order.options.length > 0
      ? ' (' + order.options.join(', ') + ')'
      : '';
    drinkEl.textContent =
      order.drink + ' ' + order.size + '사이즈' + optionsPart + ' ' +
      order.qty + '잔';

    // [3행] 요청사항(있을 때만) · 주문 시간 ───────────
    const metaEl = document.createElement('p');
    metaEl.className = 'order-card-meta';
    // 요청사항이 있으면 앞에 붙여줌
    const requestPart = order.request ? '"' + order.request + '"  ·  ' : '';
    metaEl.textContent = requestPart + order.time;

    // [취소 버튼] ────────────────────────────────────
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn-cancel';
    cancelBtn.textContent = '취소';

    // 취소 버튼 클릭 시: confirm으로 한 번 더 확인 후 해당 주문 삭제
    cancelBtn.addEventListener('click', function () {
      // confirm(): 확인/취소 대화상자를 띄워 true/false 반환
      const confirmed = confirm(
        '#' + order.id + ' ' + order.name + '님의 주문을 취소하시겠습니까?'
      );
      if (confirmed) {
        // orders 배열에서 id가 일치하는 주문만 제거
        // filter()는 조건이 true인 항목만 남긴 새 배열을 반환합니다.
        orders = orders.filter(function (o) { return o.id !== order.id; });
        renderOrders(); // 화면 다시 그리기
      }
    });

    // 만든 요소들을 카드에 추가
    card.appendChild(titleEl);
    card.appendChild(drinkEl);
    card.appendChild(metaEl);
    card.appendChild(cancelBtn);

    // 카드를 목록에 추가
    ordersList.appendChild(card);
  });

  // ── 합계 업데이트 ──────────────────────────────────
  // orders 배열의 total을 모두 더합니다.
  // reduce(누산함수, 초기값): 배열을 하나의 값으로 줄여줍니다.
  const grandTotal = orders.reduce(function (sum, o) {
    return sum + o.total;
  }, 0);

  // textContent로 삽입하여 보안 유지
  ordersTotal.textContent =
    '총 주문 금액: ' + grandTotal.toLocaleString('ko-KR') + '원 (' +
    orders.length + '건)';
}


/* =====================================================
   10. 탭 전환 함수 - switchTab(targetPanelId)
   클릭된 탭 버튼을 활성화하고 해당 패널만 보여줍니다.
   ===================================================== */

function switchTab(targetPanelId) {
  // ── 탭 버튼 활성화/비활성화 ────────────────────────
  tabBtns.forEach(function (btn) {
    const isTarget = btn.dataset.tab === targetPanelId;
    // active 클래스: 활성 탭에만 붙임
    btn.classList.toggle('active', isTarget);
    // aria-selected: 스크린 리더를 위한 접근성 속성
    btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
  });

  // ── 탭 패널 보이기/숨기기 ──────────────────────────
  tabPanels.forEach(function (panel) {
    if (panel.id === targetPanelId) {
      panel.classList.remove('hidden'); // 선택된 패널: 보이기
    } else {
      panel.classList.add('hidden');    // 나머지 패널: 숨기기
    }
  });
}

// 탭 버튼 각각에 클릭 이벤트 등록
tabBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    switchTab(btn.dataset.tab);
  });
});


/* =====================================================
   11. 폼 제출(주문하기 버튼) 이벤트
   기본 제출 동작(페이지 이동)을 막고,
   유효성 검사 → 통과 시 주문 저장 + 확인 메시지 표시
   ===================================================== */

// async: 함수 안에서 await(비동기 대기)를 사용하기 위해 필요합니다.
form.addEventListener('submit', async function (event) {
  // 브라우저 기본 제출(페이지 새로고침)을 막습니다.
  event.preventDefault();

  // 유효성 검사 실행 → 실패하면 여기서 멈춤
  if (!validateForm()) return;

  // ── 버튼 비활성화 (중복 클릭 방지) ────────────────
  // 저장이 끝나기 전에 두 번 눌리지 않도록 잠급니다.
  btnSubmit.disabled = true;
  btnSubmit.textContent = '주문 중...';

  // ── 주문 데이터 수집 ────────────────────────────────
  const order = collectOrderData();

  // ── Supabase에 저장 ─────────────────────────────────
  // supabaseClient.from('테이블명').insert(객체) 로 행을 추가합니다.
  // await: 저장이 완료될 때까지 기다린 뒤 다음 줄로 넘어갑니다.
  const { error } = await supabaseClient
    .from('cafe_menu03')
    .insert({
      customer_name: order.name,
      phone:         order.phone || null,       // 빈 문자열은 null로 저장
      drink:         order.drink,
      drink_price:   order.drinkPrice,
      size:          order.size,
      options:       order.options,             // TEXT[] 배열 그대로 전달
      quantity:      order.qty,
      request:       order.request || null,     // 빈 문자열은 null로 저장
      total_price:   order.total,
    });

  // ── 버튼 원상복구 ──────────────────────────────────
  btnSubmit.disabled = false;
  btnSubmit.textContent = '주문하기';

  // ── 저장 실패 처리 ─────────────────────────────────
  if (error) {
    // 개발자 콘솔에 상세 오류를 출력합니다 (F12 → Console 탭에서 확인)
    console.error('Supabase 저장 오류:', error);
    alert('주문 저장에 실패했어요. 다시 시도해 주세요.');
    return; // 아래 성공 처리 코드를 실행하지 않고 종료
  }

  // ── 저장 성공 처리 ─────────────────────────────────
  // 로컬 배열에도 추가해 주문 내역 탭을 즉시 갱신합니다.
  orders.unshift(order);
  renderOrders();

  // 주문 확인 메시지 표시
  const message = buildConfirmMessage(order);
  orderConfirm.textContent = message;
  orderConfirm.classList.remove('hidden');

  // 주문 확인 영역으로 부드럽게 스크롤
  orderConfirm.scrollIntoView({ behavior: 'smooth', block: 'center' });
});



/* =====================================================
   12. 다시 작성(reset) 버튼 이벤트
   주문서(폼)만 초기화합니다. 주문 내역은 지우지 않습니다.
   ===================================================== */

form.addEventListener('reset', function () {
  // reset 이벤트는 실제 입력값 초기화 이전에 발생하므로,
  // setTimeout으로 한 프레임 뒤에 후속 처리를 실행합니다.
  setTimeout(function () {

    // 오류 메시지 초기화
    nameError.textContent  = '';
    drinkError.textContent = '';

    // 주문 확인 메시지 숨기기 (주문 내역은 유지!)
    orderConfirm.textContent = '';
    orderConfirm.classList.add('hidden');

    // 금액 표시를 초기화
    // (reset 후에는 음료가 미선택 상태이므로 calculateTotal()이 0을 반환)
    updatePriceDisplay();

  }, 0); // 0ms → 현재 이벤트 처리가 끝난 직후 실행
});


/* =====================================================
   13. 내역 모두 지우기 버튼 이벤트
   ===================================================== */

btnClearAll.addEventListener('click', function () {
  // confirm()으로 실수 방지
  const confirmed = confirm('주문 내역을 모두 지우시겠습니까?');
  if (confirmed) {
    orders = [];    // 배열 초기화
    renderOrders(); // 화면 갱신 (빈 상태로)
  }
});


/* =====================================================
   14. 페이지 최초 로드 시 초기화
   ===================================================== */

// M 사이즈가 기본 선택(checked)되어 있으므로
// 페이지를 열자마자 +500원이 반영된 금액을 보여줍니다.
updatePriceDisplay();

// 주문 내역 초기 렌더링 (비어있는 상태 → 안내 문구 표시)
renderOrders();
