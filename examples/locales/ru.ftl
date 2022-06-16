greeting = Привет { $first_name }!

cart = В вашей корзине {
  $apples ->
    [one] 1 яблоко
    *[other] { $apples } яблок
  }

language-set = (In russian) Language has been set to Russian!
