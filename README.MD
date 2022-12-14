# Интеграционный интиерфейс 1С <-> HTML

## Назначение
В разработке форм на базе платформы 1С не редко приходится сталкиваться с использованием поля [HTML-документа](https://its.1c.ru/db/intgr83/content/226/hdoc). С отказом фирмы 1С от встроенного в платформу IE6 в пользу WebKit, тенденция использования нестандартных для 1С элементов веб-интерфейса, вероятно, вырастет.

Часто разработчику приходится искать пример интеграции либо в уже готовом решении, либо в интернетах, а затем "допиливать" решение под себя.

Данная библиотека призвана унифицировать и формализовать подход к реализации таких элементов интерфейса.

## Совместимость
Библиотека совместима с платформой 1С-Предприятие версии  8.3.14.1565 и выше. Если вы используете версию ниже, то перестаньте.

## Установка и плдключение
Установка выполняется из реестра npm в виде ES модуля:
```shell
npm i bsl-js
```

Подключение на странице:
```javascript
import {...} from 'bsl-js'
``` 

## Концепция библиотеки
После подключения библиотеки, в глобальной области видимости(`window.*`) становится доступен объект `integration_ctx`. Прямое использование объекта не требуется, он нужен только для 1С-ной обвязки.

Со стороны 1С, реализован специальная библиотека, работающая в паре с JS.

Концепция системы основывается на [паттерне Observer](https://ru.wikipedia.org/wiki/%D0%9D%D0%B0%D0%B1%D0%BB%D1%8E%D0%B4%D0%B0%D1%82%D0%B5%D0%BB%D1%8C_(%D1%88%D0%B0%D0%B1%D0%BB%D0%BE%D0%BD_%D0%BF%D1%80%D0%BE%D0%B5%D0%BA%D1%82%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F)), который реализован с обеих сторон интеграции системы(1С и JS). Каждая сторона интеграции подписывается на определенные события противоположной стороны. Аналогично, каждая сторона генерирует события для другой стороны.

Таким образом описание взаимодействия между 1С и JS становится формализованным и сводится к описанию последовательности событий генерируемых сторонами. При этом концепция событий никак не связана с реализацией страницы или решения 1С, т.к. представляет собой абстракцию обмена данными.

Далее, для удобства, __входящими__ событиями будем называть события отправленные из 1С в JS, а __исходящими__ - события отправленные из JS в 1С.

## Интеграция в страницу
Основные методы библиотеки позволяют "слушать" входящие события и отправлять "исходящие"

```javascript
import {sendTo1C, listenFrom1C} from 'bsl-js'

// Слушать входящее событие из 1С
listenFrom1C("some_event", data => {...})

// Отправить исходящее событие в 1С
sendTo1C("some_event", {...})

```

## Интеграция в 1С
На стороне среды исполнения 1С интеграция аналогична.

```1C
&НаКлиенте
Процедура БраузерПриНажатии(Элемент, ДанныеСобытия, СтандартнаяОбработка)
	
    // Общий обработичик событий, просто фильтрует "наши" события и стандартные события поля-HTML
	Если ИнтеграцияHTMLКлиент.ОбработатьСобытиеJS(ЭтотОбъект, Элемент, ДанныеСобытия) Тогда
		СтандартнаяОбработка = Ложь;
	КонецЕсли;
	
КонецПроцедуры

&НаКлиенте
Процедура БраузерДокументСформирован(Элемент)
	
    // Подписка на конкретное событие "ПриГенерацииМодуляФормы"
    // с привязкой ОписанияОповешения
	ИнтеграцияHTMLКлиент.ПодписатьсяНаСобытиеJS(
		ЭтотОбъект,
		"ПриГенерацииМодуляФормы",
		"Подключаемый_ПриГенерацииМодуляФормы",
		Элемент
	);
		
КонецПроцедуры

&НаКлиенте
Процедура Подключаемый_ПриГенерацииМодуляФормы(Данные, ДопПараметры = Неопределено) Экспорт

	// В параметре Данные будет десереализованный объект JS в виде структуры
	// Данные.content - для события "ПриГенерацииМодуляФормы" тут будет шаблон текста модуля формы
    Сообщить(Данные.content);
	
КонецПроцедуры

&НаКлиенте
Процедура КомандаСгенерироватьТекстМодуляФормы(Данные, ДопПараметры = Неопределено) Экспорт
    // Отправка события в JS
	ИнтеграцияHTMLКлиент.ОтправитьСобытиеJS(Элементы.Браузер, "СгенерироватьМодульФормы");
	
КонецПроцедуры
```

## Генерация кода 1С
Для генерации кода клиентской формы 1С доступно встроенное входящее событие ```СгенерироватьМодульФормы```, и соответствующее исходящее ```ПриГенерацииМодуляФормы```. Смотри пример выше.
Этот функционал введен для удобства интеграции и внутреннего тестирования, поэтому не является обязательной.

Для генерации текста модуля, разработчик страницы должен описать программный интерфейс страницы в терминах входящих и исходящих событий и зарегистрировать такое описание в библиотеке:
```javascript
import {registerEvents} from 'bsl-js'

// На входе объект описывающий входящие и исходящие события
registerEvents({eventsDescription})
```
Пример объекта описывающего события:
```javascript
export default {
    // Входящие события
    exports: [
        ...
        {   
            // Идентификатор входящего события
            id: "УстановитьСодержимое",
            // Описание события
            desc: "Устанавливает переданный текст в виде содержимое текущего документа",
            // Описание данных события
            data: {
                content: {
                    required: true,
                    desc: "Текст"
                },
                mode: {
                    desc: "Режим подсветки синтаксиса. Если не передан будет установлен режим 'text'",
                    enum: ['text', 'xml', 'json']
                }
            }
        },
        ...
    ],
    // Исходящие события
    events: [
        ...
        {
            // Идентификатор входящего события
            id: "ПриПолученииСодержимого",
            // Описание опущено
            // Описание данных события
            data: {
                content: {
                    desc: "Текст документа"
                }
            }
        }
        ....
    ]

}
```

## Описание встроенных событий

При условии наличия объекта с описанием входящих и исходящих событий(см. выше) текстовое описание протокола не требуется или его можно генерировать автоматически.

```TODO: Реализовать генерацию md с описанием протокола.```

### Исходящие события
Здесь указываются все события генерируемые страницей

- __`ПриГенерацииМодуляФормы`__
    
    Получение сгенерированного текста формы

        {
            content: string
        }

    | Поле  | Назначение |
    |   -   | - |
    | __content__ | Текст модуля формы 1С для работы со страницей, его возвращающей |

### Входящие события
Здесь указываются все события генерируемые 1С

- __`СгенерироватьМодульФормы`__

    Парное исходящее событие `ПриГенерацииМодуляФормы`