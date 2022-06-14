greeting = Привет { $name }!
cart = В вашей корзине {
  $apples ->
    [one] 1 яблоко
    *[other] { $apples } яблок
  }
